# Variant Tid.

## Getting started

You need [Bun](https://bun.sh) (the version in `.bun-version`) and Docker.

```sh
bun install
bun run dev
```

The app runs on http://localhost:3000.

Before pushing, run `bun run check`. It type-checks, lints and runs the tests.

## Database

Postgres runs in Docker through [Testcontainers](https://testcontainers.com), on whatever port is free. `bun run dev` starts it, applies new migrations, seeds a small fixture if it's empty, and stops it again when you quit. The container is kept between runs, so your data stays.

- `bun run db:reset` rebuilds the dev database from the fixture. The fixture's dates are relative to today.
- `bun run db:studio` opens Drizzle Studio against the dev database.

Tests get a fresh container each run, which is removed afterwards. Shutting down the dev server tears down database.

## Early life of Tid.

To make it easier to import Harvest data, you can can use `bun run db:import 2026-06 2026-09`.
This will rebuild the dev database from Harvest instead, but needs ta PAT token per organization to do so.
Pass them comma separated: `bun run db:import 2026-06 2026-09 --tokens <oslo>,<trondheim>`. It checks everything before touching the database, and lists every problem it finds. If needed, use `--save` to keep the raw Harvest data in `packages/db/harvest-export`. That folder is gitignored
