# Harvest import

Rebuilds the dev database from Harvest, so the app can be checked against real data. It's only needed while we move off Harvest, so it lives in its own package that can be deleted.

Each country's Harvest accounts are organized differently, so each country has its own import.

## Norwegian import

```sh
bun run harvest:import:norway <from-month> [to-month] --tokens <token>,<token> [--save]
```

Pass one Harvest personal access token per account, with months as `YYYY-MM`. It lists every problem it finds before importing anything, but the dev database is emptied either way. `--save` keeps the raw Harvest data in `packages/harvest/harvest-export`, which is gitignored.

## Norwegian import rules

How the Norwegian Harvest accounts map onto our database, and the rules the import follows where the two models disagree. Open questions live in [identified-edge-cases.md](../../docs/identified-edge-cases.md) until they're settled here.

Organizations are added by migrations, not by the import. Each Harvest account belongs to the organization with the same name, and an account without one, or one logging time in another currency, stops the import.

### Users

**One person is one user, across Harvest accounts.** Harvest users exist per account, so a consultant who logs time in several accounts appears once in each. They are merged by email, ignoring case.

A user belongs to one organization, and is assigned to projects through it. When a merged user logs time in another organization's Harvest account, their own organization is added as a participant of that project.

**Open:** which organization a merged user belongs to. Harvest can't tell us, so it's set by hand.

**Not imported:** Harvest roles, cost rates and end dates. Inactive Harvest users are imported without `ends_on`.

### Clients

**Clients are global, and matched by name ignoring case.** The same client in several Harvest accounts becomes one client. The first currency seen for a client is the one it keeps.

A client in another country is a different client, so a client never has more than one currency.

### Projects

**Projects are global, and identified by code.** The same code in several Harvest accounts, or on several projects in one account, becomes one project. Each account that logged time on it becomes a participating organization.

**Customer project codes look like `AAA9999`, or `AAA9999-S`.** The `-S` suffix is meant to mark a project that has subcontractors, but it isn't applied consistently, so the import doesn't rely on it for ownership. `AAA9999` and `AAA9999-S` are the same project, so the import merges them into one with the code `AAA9999`.

**The import doesn't decide who owns a project.** Ownership is set by hand, since we don't yet know the owner of every project.

**A project has one rate per person.** Harvest can bill per task, but we don't. If one person's rate differs between tasks on a project, the project has to be split into one project per rate before import, each with its own code.

**Billable comes from the project.** Time and materials and fixed fee projects are billable, and non-billable projects aren't. Non-billable tasks on billable projects export as billable; see `identified-edge-cases.md`.

**Non-billable projects of the Varianttid client are open to everyone.** Harvest has no such setting, so the import assumes it. Everyone else is assigned to the projects they logged time on.

**Vacation (FER1000) and paid welfare leave (VEL1000) don't count toward billable base hours.** Harvest has no such setting, so the import sets it by code. Reporting is the only thing that uses it. Whether other leave, such as sick leave or unpaid welfare leave, should be left out too is still to be confirmed.

### Time entries

**An entry keeps the rate it was logged at.** Harvest stamps the rate on each entry rather than keeping a rate history, and so do we: the import copies Harvest's billable rate and currency onto each entry, and the export reads them from there. An entry Harvest didn't rate, such as on a fixed fee project, has neither.

**Assignment rates are only for new entries.** The import also builds each assignment's rate list from the entries, with a new rate starting on the first day it's seen. Time logged in Tid afterwards gets its rate from that list, and keeps it. Moving an entry to another task or project picks the rate again; changing its hours doesn't.

**One entry per user, task and day.** Harvest entries on the same day are summed, and their notes are joined with line breaks. They must share a rate, since the merged entry has one. Hours become minutes, rounded to the nearest minute. Start and end times are dropped.

**Imported time is not locked.** Harvest's invoiced and locked status isn't imported.

### Identity and re-imports

**Rows remember where they came from in Harvest.** Users, clients, projects, tasks and time entries store their Harvest account and ID, so a re-import updates them even after a rename, a new code or a changed email in Harvest. Names, codes and emails are only used to merge across accounts.

**A re-import replaces the imported period.** Entries that were deleted from Harvest, or moved to another task, since the last import are removed. Only entries that came from Harvest are touched.

### Open

- **Fixed fee projects.** Harvest stores the fee and budget, but we only store that the project is billable, so these hours export without an amount. To be discussed with stakeholders.
