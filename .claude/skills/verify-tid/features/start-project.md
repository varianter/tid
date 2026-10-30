# Start a project

A manager starts a project from the projects page. They choose billing, fill the project form in a drawer, and land on the new project's page. A missing client can be added without leaving the form.

## Sub-features

- `project-billing` asks for billing before the form.
- `project-start` saves the project and opens its page.
- `project-errors` shows the server's errors inside the drawer.
- `project-add-client` adds a client in a layer on top, then returns to the form with that client chosen.
- `project-cancel-client` closes the client layer and keeps what was typed.

## How to get to it (user POV)

- `Projects` in the menu, then the new-project action (`a[href="/projects/new"]`).

## Driving it with agent-browser

Preconditions:

- Logged in as `henrik.vik@example.com`.

- **Open billing.** `agent-browser open <url>projects`, then `agent-browser click 'a[href="/projects/new"]'`. `:popover-open h1` starts with `New project`.
- **Choose hourly.** `agent-browser click ':popover-open a[href*="/projects/new/hourly"]'`. The drawer's form has `input[name=billing]` with the value `hourly`.
- **Fill.** Choose a client (`select[name=clientId]`) and contract owner (`select[name=contractOwnerId]`), a currency if one is offered, and fill `name` and `code`.
- **Start.** `agent-browser click ':popover-open button[type=submit]'`. The URL becomes `/projects/<id>` and `main h1` is the project's name.
- **Stored.** `.claude/skills/verify-tid/scripts/instance.ts sql $RUN "select id, name, code from projects where name = '<name>'"`.
- **Add a client.** From the open form, `agent-browser click ':popover-open a[href*="/clients/new"]'`. A `New client` layer opens on top. Save a name, and the project form's `select[name=clientId]` shows it chosen.

## Gotchas

- Both the billing step and the form are titled `New project`. Tell them apart by `input[name=billing]`.
- The billing layer stays in the DOM until it has finished closing. Wait for one layer before reading the form.
- The projects page redirects to a URL with the manager's organization in it.
- Clearing a required field triggers the browser's own validation. To see the server's errors, the e2e test sets `form.noValidate = true` first.
