# Add a rate

A manager sets a consultant's hourly rate on a project from a date. When the date covers hours already logged, a second step asks to reprice them. The rates page then shows the new rate.

## Sub-features

- `rate-add` opens the rate form in a tooltip below the action.
- `rate-reprice` moves to a repricing step in a drawer when logged hours are affected.
- `rate-dismiss` closes on Escape and leaves the page unchanged.

## How to get to it (user POV)

- A project's page, then its consultants' rates: `/projects/<projectId>/consultants/rates`, and the add-rate link on a consultant's row.

## Driving it with agent-browser

Preconditions:

- Logged in as `henrik.vik@example.com`.
- A consultant in the manager's organization with hours on the project. Find one with:
  `.claude/skills/verify-tid/scripts/instance.ts sql $RUN "select pa.project_id, pa.user_id, min(te.spent_on)::text as first_day from project_assignments pa join users m on m.email = 'henrik.vik@example.com' and m.org_id = pa.org_id join tasks t on t.project_id = pa.project_id join time_entries te on te.task_id = t.id and te.user_id = pa.user_id group by 1, 2 limit 1"`

- **Open the form.** `agent-browser open <url>projects/<projectId>/consultants/rates`, then `agent-browser click 'a[href$="/<userId>/rates/new"]'`. `:popover-open h1` starts with `New rate for`.
- **Fill.** `agent-browser fill ':popover-open input[name=rate]' 4321`, then set the date with `agent-browser eval 'document.querySelector(":popover-open input[name=validFrom]").value = "<first_day>"'`.
- **Submit.** `agent-browser click ':popover-open button[type=submit]'`. The heading changes to the repricing step, with `from` in it.
- **Reprice.** `agent-browser click ':popover-open button[type=submit]'`. The layer closes and `main` shows `4 321`.
- **Stored.** Read the consultant's rates and repriced entries back with `.claude/skills/verify-tid/scripts/instance.ts sql`.

## Gotchas

- Amounts group thousands with a space that may be non-breaking. Match `4\s321`, not `"4 321"`.
- A date after the consultant's last logged hour skips the repricing step. Use their first day to reach it.
- `fill` can't set a date input: it leaves `validFrom` empty, and the browser's own check stops the submit without a message from the server. Set it with `eval`.
