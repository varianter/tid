import { createDatabase } from "@tid/db/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

export const database = createDatabase(databaseUrl);
