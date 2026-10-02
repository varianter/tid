import type { SQL } from "bun";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";

// Takes a plain url (password baked in) or a pre-built SQL client (e.g. one with
// a dynamic password callback for token-based auth).
export function createDatabase(connection: string | SQL) {
  return drizzle(connection, { schema, casing: "snake_case" });
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
