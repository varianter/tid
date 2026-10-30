# Log hours

A consultant types hours into a cell of their month timesheet. The cell saves on Enter or when they leave it, and the row, day and month totals update without a reload.

## Sub-features

- `log-enter` saves a cell on Enter.
- `log-leave` saves a typed cell when the user leaves the page.
- `log-totals` updates project, day and grand totals in place.
- `log-decimal` accepts a comma decimal, such as `6,5`.

## How to get to it (user POV)

- Log in. The app lands on `/timesheet/month/<yyyy-mm>#today`.
- Choose another month from the timesheet's month navigation.

## Driving it with agent-browser

Preconditions:

- Logged in as `kari.nordmann@example.com`.
- The month has an empty cell the user can log on: `form[data-cell][data-minutes='0']:has(input:not([disabled]))`.

- **Find a cell.** `agent-browser eval 'JSON.stringify(document.querySelector("form[data-cell][data-minutes=\"0\"]:has(input:not([disabled]))").dataset)'`. `cell` is `<taskId>:<day>`.
- **Type hours.** `agent-browser scrollintoview 'form[data-cell="<cell>"] input[name=hours]'`, then `agent-browser click` it, `agent-browser keyboard type "6,5"`, `agent-browser press Enter`.
- **Saved in place.** `agent-browser get attr 'form[data-cell="<cell>"]' data-minutes` is `390`. `[data-grand-total]`, `[data-project-total="<project>"]` and `[data-day-total="<day>"]` went up by 6,5.
- **Stored.** `.claude/skills/verify-tid/scripts/instance.ts sql $RUN "select minutes from time_entries where task_id = <taskId> and spent_on = '<day>'"` returns `390`.
- **Survives a reload.** `agent-browser reload`, then `agent-browser get value 'form[data-cell="<cell>"] input[name=hours]'` is `6,5`.

## Gotchas

- `keyboard type` types into the focused cell. `fill` sets the value without the key events that save the cell.
- The URL keeps a `#today` fragment, so compare the path, not the full URL.
- Locked months and tasks the user can't log on have disabled inputs. The empty-cell selector skips them.
