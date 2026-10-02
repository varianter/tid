import { WorkloadIdentityCredential } from "@azure/identity";
import { SQL } from "bun";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";

const POSTGRES_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

// AZURE_CLIENT_ID = workload identity, url has no password then, get an Entra
// token instead. Fetch fresh token per connect, token only lives ~1h, no
// caching here (the azure SDK already caches under the hood).
async function fetchPostgresToken(credential: WorkloadIdentityCredential) {
  const token = await credential.getToken(POSTGRES_AAD_SCOPE);
  if (!token) throw new Error("no azure AD token for postgres, workload identity broken?");
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
