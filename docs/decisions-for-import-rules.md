# Decisions for import rules

How Harvest data maps onto our database, and the rules the import follows where the two models disagree. Open questions live in `identified-edge-cases.md` until they're settled here.

Each Harvest account, such as Variant Trondheim AS, becomes one organization.

## Users

**One person is one user, across Harvest accounts.** Harvest users exist per account, so a consultant who logs time in several accounts appears once in each. They are merged by email, ignoring case.

A user belongs to one organization, and is assigned to projects through it. When a merged user logs time in another organization's Harvest account, their own organization is added as a participant of that project.

**Open:** which organization a merged user belongs to. Harvest can't tell us, so it's set by hand.

**Not imported:** Harvest roles, cost rates and end dates. Inactive Harvest users are imported without `ends_on`.

## Clients

**Clients are global, and matched by name ignoring case.** The same client in several Harvest accounts becomes one client. The first currency seen for a client is the one it keeps.

A client in another country is a different client, so a client never has more than one currency.

## Projects

**Projects are global, and identified by code.** The same code in several Harvest accounts, or on several projects in one account, becomes one project. Each account that logged time on it becomes a participating organization.

**Customer project codes look like `AAA9999`, or `AAA9999-S` for subcontracting.** An organization that works as a subcontractor on another organization's `AAA9999` logs time on its own `AAA9999-S`. The two are separate projects, and never live in the same Harvest account.

**A `-S` code is owned by the Harvest account it's in.** Only one organization may have a given `-S` code. If it shows up in more than one account, the import must warn.

**The import doesn't decide who owns a project yet.** For now ownership is set by hand. The `-S` suffix will let the import set an owner for subcontracted projects, but the rest still need an owner set by hand.

**A project has one rate per person.** Harvest can bill per task, but we don't. If one person's rate differs between tasks on a project, the project has to be split into one project per rate before import, each with its own code.

**Billable comes from the project.** Time and materials and fixed fee projects are billable, and non-billable projects aren't. Non-billable tasks on billable projects export as billable; see `identified-edge-cases.md`.

**Non-billable projects of the Varianttid client are open to everyone.** Harvest has no such setting, so the import assumes it. Everyone else is assigned to the projects they logged time on.

## Time entries

**An entry keeps the rate it was logged at.** Harvest stamps the rate on each entry rather than keeping a rate history, and so do we. This avoids working out when rates changed, and conflicting rate history between imports.

**One entry per user, task and day.** Harvest entries on the same day are summed, and their notes are joined with line breaks. Hours become minutes, rounded to the nearest minute. Start and end times are dropped.

**Imported time is not locked.** Harvest's invoiced and locked status isn't imported.

## Identity and re-imports

**Rows remember where they came from in Harvest.** Users, clients, projects, tasks and time entries store their Harvest account and ID, so a re-import updates them even after a rename, a new code or a changed email in Harvest. Names, codes and emails are only used to merge across accounts.

**A re-import replaces the imported period.** Entries that were deleted from Harvest, or moved to another task, since the last import are removed. Only entries that came from Harvest are touched.

## Open

- **Fixed fee projects.** Harvest stores the fee and budget, but we only store that the project is billable, so these hours export without an amount. To be discussed with stakeholders.
