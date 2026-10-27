import { watch } from "node:fs";
import { dirname } from "node:path";
import { createDatabase, migrateDatabase } from "@tid/db/client";
import { startDevelopmentDatabase } from "@tid/db/container";
import { users } from "@tid/db/schema";
import { seedDatabase } from "@tid/db/seedDatabase";

const container = await startDevelopmentDatabase();
const databaseUrl = container.getConnectionUri();

const database = createDatabase(databaseUrl);
await migrateDatabase(database);
if ((await database.$count(users)) === 0) await seedDatabase(database);
await database.$client.close();
console.log(`Postgres running at ${databaseUrl}`);

// Watching only the server keeps the database running while code reloads.
const startServer = () =>
  Bun.spawn([process.execPath, "--watch", `${import.meta.dir}/server.tsx`], {
    env: { ...process.env, DATABASE_URL: databaseUrl, DEV_LOGIN: "true" },
    stdio: ["inherit", "inherit", "inherit"],
  });
let server = startServer();

// `--watch` only sees what the server imports, and the server bundles these instead.
for (const browserPackage of ["@tid/elements", "@tid/via"]) {
  const source = dirname(Bun.fileURLToPath(import.meta.resolve(`${browserPackage}/browser`)));
  watch(source, { recursive: true }, restartServer);
}

let restarting = false;
// One save can fire several events, so those during a restart are dropped rather than starting
// a second server. The new one bundles after they've landed.
async function restartServer() {
  if (restarting) return;
  restarting = true;
  server.kill();
  await server.exited;
  server = startServer();
  restarting = false;
}

async function stopDevelopment() {
  server.kill();
  // Stopped, not removed, so the data is still there on the next run. The timeout lets
  // Postgres shut down cleanly instead of being killed.
  await container.stop({ remove: false, timeout: 10_000 });
  process.exit();
}
process.on("SIGINT", stopDevelopment);
process.on("SIGTERM", stopDevelopment);
