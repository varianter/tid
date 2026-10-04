import { WorkloadIdentityCredential } from "@azure/identity";
import { SQL } from "bun";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";

const POSTGRES_ENTRA_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

/**
 * With workload identity the URL carries no password. Entra tokens expire
 * after about an hour, so each new connection asks for one; the SDK caches
 * it until then.
 */
async function fetchPostgresToken(credential: WorkloadIdentityCredential) {
  const token = await credential.getToken(POSTGRES_ENTRA_SCOPE);
  if (!token) throw new Error("Workload identity returned no Entra token for Postgres");
  return token.token;
}

/**
 * AZURE_CLIENT_ID is only set in Azure environments, so elsewhere (local
 * development, CI) the URL's own credentials are used instead of workload identity.
 */
function connection(url: string) {
  if (!process.env.AZURE_CLIENT_ID) return url;
  const credential = new WorkloadIdentityCredential();
  return new SQL(url, { password: () => fetchPostgresToken(credential) });
}

/**
 * Transparently authenticates with workload identity when available,
 * falling back to the URL's own credentials otherwise.
 */
export function createDatabase(url: string) {
  return drizzle(connection(url), { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDatabase>;

export function migrateDatabase(database: Database) {
  return migrate(database, { migrationsFolder: `${import.meta.dir}/../migrations` });
}

// A running dev server's prepared statements refer to types by id, which a rebuild changes.
// Ending its connections makes it reconnect instead of failing with "cache lookup failed".
export function closeOtherConnections(database: Database) {
  return database.execute(
    sql`select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()`,
  );
}

// Drops all data and applies the full chain of migrations to an empty database.
export async function rebuildDatabase(database: Database) {
  await database.execute(sql`drop schema if exists public, drizzle cascade`);
  await database.execute(sql`create schema public`);
  await migrateDatabase(database);
}
