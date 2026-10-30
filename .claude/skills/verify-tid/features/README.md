# Tid verification map

The maintained source for verifying what a Tid user can do. Read this index before driving the app, then follow the feature's file.

## Baseline preconditions

- An instance started by this run with `instance.ts start`, and `instance.ts doctor` all `ok`.
- The fixture as seeded. Its dates are relative to today, so the current month always has days to log.
- An `agent-browser` session named after the run, with a 1920×1080 viewport and reduced motion.

## Driving conventions

- Log in through `/dev/login` as the fixture user the feature names.
- Find cells, rows and links by `data-*` attributes, field names, `href`s and headings, not by position.
- A form in a layer is inside `:popover-open`. The layer on top is the last one opened.
- A recipe changes data only on this run's instance, so there's nothing to restore.

## Proof and skip reporting

- Screenshot the state before and after the action.
- Read a write back from the database with `instance.ts sql` and save it next to the screenshots.
- Reload and check that the page shows what was stored.
- Check that `agent-browser errors` and `agent-browser console` show no errors.
- Name the feature and entry point with each piece of evidence.
- When a path can't be reached, report the command tried and the missing precondition. Never report it as verified through another path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph on what the user sees. Then four H2s, in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with agent-browser` (starting with `Preconditions:`), and `Gotchas`. Leave implementation out. Name user paths, handles, state and proof.

## Features

- [Log hours](./log-hours.md): typing hours into the timesheet grid, saving and totals.
- [Start a project](./start-project.md): the new-project layers, adding a client from inside them, and server errors.
- [Add a rate](./add-rate.md): a consultant's rate on a project, including the repricing step.
- [Delete a rate](./delete-rate.md): a rate that hasn't started, and repricing the hours logged in its period.
- [Close a month](./month-close.md): locking and unlocking an organization's month.
