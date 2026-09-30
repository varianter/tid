import { createDatabase, migrateDatabase } from "../src/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const database = createDatabase(url);
await migrateDatabase(database);
await database.$client.close();
