---
name: verify-tid
description: Launch a disposable Tid (the Hono web app in apps/web) with its own Postgres and fixture, drive it in a real browser as a fixture user with agent-browser, and capture proof. Use to prove a change to a page, form or command works the way a user meets it, beyond what the unit and e2e tests reach.
---

# Verify Tid

Tid is a server-rendered web app. A user touches it only through the browser, so a proof means driving pages in Chrome and checking what the database stored.

Each run gets its own instance: a fresh Postgres container, the fixture seeded, dev login on, and the app on a free port bound to `127.0.0.1`. Never drive the user's `bun run dev` instance. It shares their data and reloads mid-run.

## Run directory

Pick a run id and keep using it for the whole run:

```sh
RUN=$PWD/.claude/verify-runs/<run-id>   # gitignored; absolute, as agent-browser resolves paths from its own directory
export AGENT_BROWSER_SESSION=verify-tid-<run-id>
```

Run commands from the repo root. `$RUN/instance.json` describes the instance. Evidence goes in `$RUN/evidence/` and outlives cleanup.

## Launch

Needs Docker (`docker info`). If Testcontainers can't find it, see README → Troubleshooting.

Start it in the background, since `start` stays in the foreground until stopped:

```sh
.claude/skills/verify-tid/scripts/instance.ts start $RUN
```

It is ready when it prints `ready <url>`, after migrations and the seed have finished. That takes about 10–30 seconds. An error before `ready` means no instance exists, so fix the error and start again.

The instance doesn't reload. Restart it after changing code: `stop`, then `start`.

## Doctor

Run it first, and again whenever anything looks off:

```sh
.claude/skills/verify-tid/scripts/instance.ts doctor $RUN
```

Every line must be `ok`. It checks that the process is up, the container exists, `/dev/login` answers, the fixture is seeded, and the instance runs the checked-out commit. It exits 1 on any `FAIL`. A commit mismatch means code changed since start, so restart.

## Drive

Use `agent-browser`. Run `agent-browser skills get core` once if you haven't used it. Set up the session once per run, before the first page:

```sh
agent-browser set viewport 1920 1080        # the month grid needs the width
agent-browser set media light reduced-motion  # smooth scrolling slows every click
```

Log in through dev login, the way the e2e tests do. Fixture users:

| Who | Email | Use for |
| --- | --- | --- |
| Employee | `kari.nordmann@example.com` | Logging hours |
| Manager | `henrik.vik@example.com` | Projects, rates, month close, administration |

```sh
agent-browser open <url>dev/login
agent-browser click 'form:has(input[value="<email>"]) button'
agent-browser get url    # /timesheet/month/<yyyy-mm>#today once logged in
```

The login page also lists newcomers who aren't users yet, for driving sign-up. Logging in as someone else replaces the cookie.

Prefer handles the app already exposes: `data-*` attributes on the timesheet (`data-cell`, `data-day`, `data-minutes`, `data-project-total`, `data-grand-total`), form field `name`s, `href`s, and `h1` text. Forms open in layers, which are popovers: `:popover-open` is the one on top. Use `agent-browser snapshot -i` when you need to find a control by role and name.

`agent-browser fill` can't set an `input[type=date]`. Set its `value` with `agent-browser eval`.

Read the database to check side effects:

```sh
.claude/skills/verify-tid/scripts/instance.ts sql $RUN "select * from time_entries where user_id = 1 limit 5"
```

The feature map in [features/README.md](features/README.md) has a recipe per feature.

## Evidence

A proof covers the action and its result:

- A screenshot before and after the action: `agent-browser screenshot $RUN/evidence/<feature>-<step>.png`.
- The stored row, read back with `sql` and saved: `.claude/skills/verify-tid/scripts/instance.ts sql $RUN "<query>" > $RUN/evidence/<feature>-row.json`.
- What a user sees after a reload, so the page reflects stored state and not just client-side state.
- No page errors or console errors: `agent-browser errors` and `agent-browser console` show none.

Drive the pages a user would. Don't post to commands directly or write to the database to set up a journey, except for reading. If the fixture lacks what a journey needs, report that and the missing precondition. Don't weaken the journey.

## Cleanup

```sh
agent-browser close
.claude/skills/verify-tid/scripts/instance.ts stop $RUN
```

`stop` signals only the process in `instance.json`, waits until both it and its container are gone, and leaves `$RUN/evidence/` in place. If the process died uncleanly, Testcontainers' reaper removes the container shortly after. Never kill Bun or Docker processes by name.

Delete `$RUN` once the user has seen the evidence.
