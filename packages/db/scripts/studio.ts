import { startDevelopmentDatabase } from "../src/container";

const container = await startDevelopmentDatabase();
const studio = Bun.spawn(["bunx", "drizzle-kit", "studio"], {
  cwd: `${import.meta.dir}/..`,
  env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
  stdio: ["inherit", "inherit", "inherit"],
});
process.exit(await studio.exited);
