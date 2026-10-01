import { PostgreSqlContainer } from "@testcontainers/postgresql";

const image = "postgres:17-alpine";

// Reused across runs, so dev data survives restarts. Stop it without removing it to keep the data.
export function startDevelopmentDatabase() {
  return new PostgreSqlContainer(image).withDatabase("tid").withReuse().start();
}

// A fresh container every run, removed when the tests finish or the process dies.
export function startTestDatabase() {
  return new PostgreSqlContainer(image).withDatabase("tid_test").start();
}
