import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";

export function createDatabase(url: string) {
  return drizzle(url, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDatabase>;

export function migrateDatabase(database: Database) {
  return migrate(database, { migrationsFolder: `${import.meta.dir}/../migrations` });
}
