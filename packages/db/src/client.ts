import { WorkloadIdentityCredential } from "@azure/identity";
import { SQL } from "bun";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";

const POSTGRES_ENTRA_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

// With workload identity the URL carries no password. Entra tokens expire after
// about an hour, so each new connection asks for one; the SDK caches it until then.
async function fetchPostgresToken(credential: WorkloadIdentityCredential) {
  const token = await credential.getToken(POSTGRES_ENTRA_SCOPE);
  if (!token) throw new Error("Workload identity returned no Entra token for Postgres");
  return token.token;
}

function connection(url: string) {
  if (!process.env.AZURE_CLIENT_ID) return url;
  const credential = new WorkloadIdentityCredential();
  return new SQL(url, { password: () => fetchPostgresToken(credential) });
}

export function createDatabase(url: string) {
  return drizzle(connection(url), { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDatabase>;

export function migrateDatabase(database: Database) {
  return migrate(database, { migrationsFolder: `${import.meta.dir}/../migrations` });
}

// Drops all data and applies the full chain of migrations to an empty database.
export async function rebuildDatabase(database: Database) {
  await database.execute(sql`drop schema if exists public, drizzle cascade`);
  await database.execute(sql`create schema public`);
  await migrateDatabase(database);
}
