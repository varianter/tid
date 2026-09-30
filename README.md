# Placeholder repo for Variants Harvest successor

## Getting started

You need [Bun](https://bun.sh) (the version in `.bun-version`) and Docker.

```sh
bun install
bun run db:up
bun run dev
```

The app runs on http://localhost:3000.

Before pushing, run `bun run check`. It type-checks, lints and runs the tests, which need Postgres running.

## Database

`bun run db:up` starts Postgres, waits until it's ready and applies any new migrations. Postgres runs on port 5433. Tests use a separate `tid_test` database and rebuild it on every run.
