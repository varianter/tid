# Harvest import

Rebuilds the dev database from Harvest, so the app can be checked against real data. It's only needed while we move off Harvest, so it lives in its own package that can be deleted.

Each country's Harvest accounts are organized differently, so each country has its own import.

## Norwegian import

```sh
bun run harvest:import:norway [from-month [to-month]] --tokens <token>,<token> [--save] [--verbose]
```

Pass one Harvest personal access token per account, with months as `YYYY-MM`. It lists every problem it finds before importing anything, but the dev database is emptied either way. `--save` keeps the raw Harvest data in `packages/harvest/harvest-export`, which is gitignored. `--verbose` shows what Harvest becomes, as tables, before anything is written.

## Today's state and history

The import comes in two parts, since Tid takes over from Harvest at the end of a month.

- **Today's state** is what people need to log time from day one: users, clients, projects, tasks, assignments and their rates. It's what's imported when no months are given, and it reads no time entries.
- **History** is time entries for the months given, imported once Harvest is frozen. It brings along the inactive users, archived projects and tasks those entries refer to.

Rules below that depend on time entries only apply to history.

## Norwegian import rules

How the Norwegian Harvest accounts map onto our database, and the rules the import follows where the two models disagree. Open questions live in [identified-edge-cases.md](../../docs/identified-edge-cases.md) until they're settled here.

Organizations are added by migrations, not by the import. Each Harvest account belongs to the organization with the same name, and an account without one, or one logging time in another currency, stops the import.

### Users

**One person is one user, across Harvest accounts.** Harvest users exist per account, so a consultant who logs time in several accounts appears once in each. They are merged by email, ignoring case.

**Active users are imported, and inactive ones only with history they logged time in.** Everyone who may log time today is there from day one, history or not.

A user belongs to one organization, and is assigned to projects through it. When a merged user is assigned to or logs time on another organization's project, their own organization is added as a participant of that project.

**A merged user belongs to the organization where they work the most:** the account they're assigned to the most projects in, then, with history, the one they logged the most time in. Harvest can't tell us, so the import warns and it's corrected by hand.

**Anyone with more than a member's access in Harvest is a Tid manager.** Administrators, managers and project managers in any account get the manager role.

**Not imported:** other Harvest roles, cost rates and end dates. Inactive Harvest users are imported without `ends_on`.

### Clients

**Clients are global, and matched by name ignoring case.** The same client in several Harvest accounts becomes one client. The first currency seen for a client is the one it keeps.

A client in another country is a different client, so a client never has more than one currency.

### Projects

**Active projects are imported, and archived ones only with history logged on them.**

**Projects are global, and identified by code.** The same code in several Harvest accounts, or on several projects in one account, becomes one project. Each account that logged time on it becomes a participating organization.

**Customer project codes look like `AAA9999`, or `AAA9999-S`.** The `-S` suffix is meant to mark a project that has subcontractors, but it isn't applied consistently, so the import doesn't rely on it for ownership. `AAA9999` and `AAA9999-S` are the same project, so the import merges them into one with the code `AAA9999`.

**The import doesn't decide who owns a project.** Ownership is set by hand, since we don't yet know the owner of every project.

**A project has one rate per person.** Harvest bills a project at one rate, at each person's rate or at each task's rate, and the import takes the rate from wherever that is. When a project billed per task prices its billable tasks differently, each task stands for a level or a year's price, so each person gets the rate they were last billed at on the project, which takes history. Without it, or without time logged on the project, they get no rate, to be set by hand.

**Billable comes from the project.** Time and materials and fixed fee projects are billable, and non-billable projects aren't. Non-billable tasks on billable projects export as billable; see `identified-edge-cases.md`.

**Non-billable projects of the Varianttid client are open to everyone.** Harvest has no such setting, so the import assumes it. Other projects get Harvest's active assignments; assignments to archived projects, and of deactivated users, are left out.

**Tasks are the project's active Harvest tasks, and with history, any task time was logged on.**

**Vacation (FER1000) and paid welfare leave (VEL1000) don't count toward billable base hours.** Harvest has no such setting, so the import sets it by code. Reporting is the only thing that uses it. Whether other leave, such as sick leave or unpaid welfare leave, should be left out too is still to be confirmed.

### Time entries

**An entry keeps the rate it was logged at.** Harvest stamps the rate on each entry rather than keeping a rate history, and so do we: the import copies Harvest's billable rate and currency onto each entry, and the export reads them from there. An entry Harvest didn't rate, such as on a fixed fee project, has neither.

**Assignment rates are only for new entries.** Harvest only knows each assignment's current rate, so the import gives it one rate, valid from when the person was assigned in Harvest. Older rates live on the entries. Time logged in Tid afterwards gets its rate from that list, and keeps it. Moving an entry to another task or project picks the rate again; changing its hours doesn't.

**One entry per user, task and day.** Harvest entries on the same day are summed, and their notes are joined with line breaks. They must share a rate, since the merged entry has one. Hours become minutes, rounded to the nearest minute. Start and end times are dropped.

**Imported time is not locked.** Harvest's invoiced and locked status isn't imported.

### Identity

**Rows are matched by what identifies them in Tid:** users by email, clients by name, projects by code and tasks by project and name. Harvest IDs aren't stored, since they'd outlive Harvest. A rename in Harvest therefore looks like one row gone and a new one.

**An import adds what's missing and changes nothing without asking.** The database also holds what was entered in Tid, so where a row differs from Harvest, the difference is reported, and only changed when someone accepts it. A preview writes everything and rolls it back, so it finds what Postgres would reject too. Nothing is deleted.

**An accepted rate applies from today,** so time already logged in Tid keeps the rate it got.

### Open

- **Fixed fee projects.** Harvest stores the fee and budget, but we only store that the project is billable, so these hours export without an amount. To be discussed with stakeholders.
