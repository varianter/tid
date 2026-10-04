import { createDatabase, migrateDatabase } from "@tid/db/client";
import { startDevelopmentDatabase } from "@tid/db/container";
import { seedDatabase } from "@tid/db/fixture";
import { users } from "@tid/db/schema";

const container = await startDevelopmentDatabase();
const databaseUrl = container.getConnectionUri();

const database = createDatabase(databaseUrl);
await migrateDatabase(database);
if ((await database.$count(users)) === 0) await seedDatabase(database);
await database.$client.close();
console.log(`Postgres running at ${databaseUrl}`);

// Watching only the server keeps the database running while code reloads.
const server = Bun.spawn([process.execPath, "--watch", `${import.meta.dir}/server.tsx`], {
  env: { ...process.env, DATABASE_URL: databaseUrl, DEV_LOGIN: "true" },
  stdio: ["inherit", "inherit", "inherit"],
});

async function stopDevelopment() {
  server.kill();
  // Stopped, not removed, so the data is still there on the next run. The timeout lets
  // Postgres shut down cleanly instead of being killed.
  await container.stop({ remove: false, timeout: 10_000 });
  process.exit();
}
process.on("SIGINT", stopDevelopment);
process.on("SIGTERM", stopDevelopment);
