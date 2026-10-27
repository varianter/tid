import { createDatabase, rebuildDatabase } from "@tid/db/client";
import { seedDatabase } from "@tid/db/seedDatabase";

// Runs the app in this process against a fresh database, so a run needs only Docker and Chrome.
// Module scope, so every e2e file in a run shares one app and one database.
export const database = createDatabase(process.env.DATABASE_URL ?? "");
await rebuildDatabase(database);
await seedDatabase(database);

// The server reads this when it's imported.
process.env.DEV_LOGIN = "true";
const app = (await import("../src/server")).default;
export const server = Bun.serve({ ...app, port: 0 });
