# Delete a rate

A manager deletes a consultant's rate that hasn't started yet. A drawer shows the hours logged in its period and what they'll cost at the rate before it, or that they'll have no rate. Confirming deletes the rate and reprices them.

## Sub-features

- `delete-confirm` lists the entries the delete reprices, with old rate, new rate and difference.
- `delete-reprice` prices those entries at the rate before the deleted one.
- `delete-only-rate` leaves the entries without a rate when no earlier rate exists.
- `delete-nothing-logged` says no logged hours change, and deletes on confirm.

## How to get to it (user POV)

- A project's consultant rates, `/projects/<projectId>/consultants/rates`, and `Delete` on a rate that starts after today. Started rates have no `Delete`.

## Driving it with agent-browser

Preconditions:

- A future rate. The fixture gives `henrik.vik@example.com` one on `Kundeportal` (project `10`). Find others with `.claude/skills/verify-tid/scripts/instance.ts sql $RUN "select project_id, user_id, valid_from::text from assignment_rates where valid_from > current_date"`.
- Hours logged in its period by that consultant. Log them as that consultant through the timesheet ([Log hours](./log-hours.md)), choosing a day on or after the rate's start.

- **Open.** Log in as `henrik.vik@example.com`, `agent-browser open <url>projects/<projectId>/consultants/rates`, then `agent-browser click 'a[href$="/<userId>/rates/<validFrom>/delete"]'`. `:popover-open` has `data-type` `drawer`, and its `h1` starts with `Delete the rate for`.
- **Review.** `agent-browser get text ':popover-open'` lists each entry with `Old rate` at the deleted rate and `New rate` at the one before it, or `No rate`.
- **Confirm.** `agent-browser click ':popover-open button[type=submit]'`. The layer closes and the rate is gone from the consultant's list.
- **Stored.** `.claude/skills/verify-tid/scripts/instance.ts sql $RUN "select spent_on::text, rate, currency from time_entries where user_id = <userId> and spent_on >= '<validFrom>'"` shows the rate before it, or `null` rate and currency.

## Gotchas

- Henrik is both the consultant and the manager in the fixture's example, so one login covers the whole journey.
- With nothing logged in the period, the layer is a dialog rather than a drawer.
