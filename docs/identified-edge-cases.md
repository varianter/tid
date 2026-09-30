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

Open questions: should their assignments end or move with them? Which currency applies to hours logged before the move, given that the export bills in the user's current organization's currency?

**Currently:** the database rejects the change.

## Importing from Harvest (on hold)

The database enforces some rules that Harvest may not have: users can only be assigned through one of the project's organizations, and emails must be unique regardless of case. Imported history that breaks these rules will be rejected, so it needs cleaning or a decision before import.
