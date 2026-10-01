# Placeholder repo for Variants Harvest successor

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

Tests get a fresh container each run, which is removed afterwards.
