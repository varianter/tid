# Identified edge cases

Open questions we've spotted but not settled. Each one says what currently happens.

## Logging time outside a date range

Assignments, projects, tasks and users all have optional start and end dates. Should logging time outside them be rejected?

- Before an assignment's `starts_on` or after its `ends_on`
- After a project's or task's `ends_on`
- After the user's own `ends_on`

**Leaning:** allow it, so hours can always be logged. We're not sure yet.

**Currently:** nothing checks these dates.

## Moving a user to another organization

An assignment records the user's organization, and the database requires it to match the user's current one. So `users.org_id` can't be changed while the user has assignments.

Open question: should their assignments end or move with them?

Settled: hours logged before the move keep their currency, since each entry stores the rate and currency it was logged at. The export still reports them under the user's current organization, though.

**Currently:** the database rejects the change.

## Billable tasks on a billable project

Harvest sets billing per project (time and materials, fixed fee or non-billable), but each task on a project can also be marked non-billable. We only have `projects.billable`. In August 2026, STI1001 had a billable task (Forberedelser) and a non-billable one (Kundeoppfølging).

Moving `billable` to tasks would record this faithfully, but the rule that open projects can't be billable would then span two tables.

**Currently:** the project's billing type decides, so every task on a billable project exports as billable.

## One Harvest account for several organizations

Sweden probably has one Harvest account for all its offices, while each office is its own organization. Which organization should its users and projects go to?

**Currently:** the import only accepts accounts named exactly like an organization, so it stops on that account.

## Importing from Harvest (on hold)

The database enforces some rules that Harvest may not have: users can only be assigned through one of the project's organizations, and emails must be unique regardless of case. Imported history that breaks these rules will be rejected, so it needs cleaning or a decision before import. Settled rules are in the [Harvest import](../packages/harvest/README.md).
