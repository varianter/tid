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

// Reused across runs, so dev data survives restarts. Stop it without removing it to keep the data.
export function startDevelopmentDatabase() {
  return new LocalOnlyPostgreSqlContainer(image).withDatabase("tid").withReuse().start();
}

// A fresh container every run, removed when the tests finish or the process dies.
export function startTestDatabase() {
  return new LocalOnlyPostgreSqlContainer(image).withDatabase("tid_test").start();
}
