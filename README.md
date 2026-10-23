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

The app connects as the role `app`, which can only use what migrations grant it and has statement and idle-transaction timeouts. Migrations, fixtures and schema tests run as the container's superuser. A new table, or a new kind of write to an existing one, needs a grant in its migration.

Tests get a fresh container each run, which is removed afterwards. Shutting down the dev server tears down database.

### Troubleshooting

**"Could not find a working container runtime strategy"**: Testcontainers can't find Docker. Check that Docker is running (`docker info`). If you use Colima, OrbStack or similar, Testcontainers doesn't read Docker contexts, so point it at the socket yourself, e.g. in your shell config:

```sh
export DOCKER_HOST=$(docker context inspect --format '{{.Endpoints.docker.Host}}')
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
```

## Deployment

Tid is deployed from [varianter/infrastructure-as-code](https://github.com/varianter/infrastructure-as-code)

- [values.yaml](https://github.com/varianter/infrastructure-as-code/blob/main/deployments/dev/workloads/tid/values.yaml): image tag, environment variables, auth, migration job and resources.
- [Workload README](https://github.com/varianter/infrastructure-as-code/blob/main/deployments/dev/workloads/tid/README.md): one-time database and identity setup, and how migrations run.
- [ArgoCD application](https://github.com/varianter/infrastructure-as-code/blob/main/deployments/dev/argocd-apps/tid.yaml): sync policy. Its live status is in the [ArgoCD dashboard](https://argocd.variant.dev/applications/argocd/tid-dev).
- Terraform for the [Postgres server and managed identity](https://github.com/varianter/infrastructure-as-code/blob/main/environments/prod/cluster/postgresql-tid.tf) and the [Entra app registration](https://github.com/varianter/infrastructure-as-code/blob/main/environments/prod/cluster/tid-oauth.tf).
