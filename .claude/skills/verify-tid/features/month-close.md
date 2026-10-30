# Close a month

A manager reviews who still has hours missing in a month and locks it for their organization. A locked month can no longer be logged on. A locked month can be unlocked again.

## Sub-features

- `close-review` lists consultants as still missing hours or all logged.
- `close-lock` locks a month that has started.
- `close-unlock` unlocks a locked month, including a future one.
- `close-enforced` disables the timesheet cells of a locked month.

## How to get to it (user POV)

- `Month close` in the menu: `/month-close`, which redirects to the current month for the manager's organization.

## Driving it with agent-browser

Preconditions:

- Logged in as `henrik.vik@example.com`.
- The month has started. Future months have no lock button.

- **Open.** `agent-browser open <url>month-close`. `h1` starts with `Month close`.
- **Lock.** `agent-browser click 'form[action$="/lock"] button[type=submit]'`. The button reads `Lock <month name>`.
- **Stored.** `.claude/skills/verify-tid/scripts/instance.ts sql $RUN "select * from month_locks order by id desc limit 1"`.
- **Enforced.** Log in as a consultant in the same organization and open that month's timesheet. Its cells' `input[name=hours]` are disabled.
- **Unlock.** Back as the manager, `agent-browser click 'form[action$="/unlock"] button[type=submit]'`.

## Gotchas

- A lock applies to the whole organization on this instance, so later log-hours recipes in the same run can't log in that month. Unlock it, or run month close last.
- Check that the consultant is in the manager's organization before testing enforcement. Dev login lists each person's organization.
