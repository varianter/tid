import { PostgreSqlContainer } from "@testcontainers/postgresql";

const image = "postgres:17-alpine";

// Docker publishes ports on every interface by default, which would expose the database to the
// local network. Testcontainers has no public option for the host IP, so set it on the bindings.
class LocalOnlyPostgreSqlContainer extends PostgreSqlContainer {
  override start() {
    for (const bindings of Object.values(this.hostConfig.PortBindings ?? {})) {
      for (const binding of bindings as { HostIp?: string }[]) binding.HostIp = "127.0.0.1";
    }
    return super.start();
  }
}

// Testcontainers' own error doesn't say that Docker is missing or hiding behind a Docker context.
async function startDatabase(container: LocalOnlyPostgreSqlContainer) {
  try {
    return await container.start();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("container runtime strategy"))
      throw error;
    throw new Error("Testcontainers can't find Docker. See README → Troubleshooting.", {
      cause: error,
    });
  }
}

// Reused across runs, so dev data survives restarts. Stop it without removing it to keep the data.
export function startDevelopmentDatabase() {
  return startDatabase(new LocalOnlyPostgreSqlContainer(image).withDatabase("tid").withReuse());
}

// A fresh container every run, removed when the tests finish or the process dies.
export function startTestDatabase() {
  return startDatabase(new LocalOnlyPostgreSqlContainer(image).withDatabase("tid_test"));
}
