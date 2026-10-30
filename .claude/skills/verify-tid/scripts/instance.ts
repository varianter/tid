#!/usr/bin/env bun
// Runs one disposable Tid for a verification run: its own Postgres container, the fixture and
// dev login, on a free port. Everything about the instance lives in the run directory, so
// concurrent runs never share state and the evidence outlives the instance.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SQL } from "bun";
import { createDatabase, rebuildDatabase } from "../../../../packages/db/src/client";
import { startTestDatabase } from "../../../../packages/db/src/container";
import { seedDatabase } from "../../../../packages/db/src/seedDatabase";

type Instance = {
  pid: number;
  url: string;
  databaseUrl: string;
  containerId: string;
  commit: string;
};

const usage = `Usage: .claude/skills/verify-tid/scripts/instance.ts <command> <run-dir> [args]

  start <run-dir>          Start an instance and stay in the foreground until stopped.
  doctor <run-dir>         Check that the instance is worth driving.
  sql <run-dir> <query>    Run SQL against the instance's database and print the rows.
  stop <run-dir>           Stop the instance and remove its database. Keeps the evidence.`;

function exitWithUsage(): never {
  console.error(usage);
  process.exit(2);
}

const [command = exitWithUsage(), runDirectory = exitWithUsage(), ...args] = process.argv.slice(2);
const instanceFile = join(runDirectory, "instance.json");

const currentCommit = () =>
  Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"]).stdout.toString().trim();

async function readInstance(): Promise<Instance> {
  const file = Bun.file(instanceFile);
  if (!(await file.exists())) throw new Error(`No instance in ${runDirectory}. Run start first.`);
  return file.json();
}

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const containerExists = (containerId: string) =>
  Bun.spawnSync(["docker", "inspect", containerId], { stdout: "ignore", stderr: "ignore" })
    .exitCode === 0;

async function start() {
  if (await Bun.file(instanceFile).exists()) {
    const instance = await readInstance();
    if (isRunning(instance.pid))
      throw new Error(`${runDirectory} already has an instance at ${instance.url}`);
  }
  await mkdir(join(runDirectory, "evidence"), { recursive: true });

  const container = await startTestDatabase();
  const databaseUrl = container.getConnectionUri();
  const database = createDatabase(databaseUrl);
  await rebuildDatabase(database);
  await seedDatabase(database);
  await database.$client.close();

  // The server reads both when it's imported.
  process.env.DATABASE_URL = databaseUrl;
  process.env.DEV_LOGIN = "true";
  const app = (await import("../../../../apps/web/src/server")).default;
  const server = Bun.serve({ ...app, port: 0 });

  const instance: Instance = {
    pid: process.pid,
    url: server.url.href,
    databaseUrl,
    containerId: container.getId(),
    commit: currentCommit(),
  };
  await Bun.write(instanceFile, JSON.stringify(instance, null, 2));

  async function stopInstance() {
    await server.stop(true);
    await container.stop();
    process.exit();
  }
  process.on("SIGINT", stopInstance);
  process.on("SIGTERM", stopInstance);
  console.log(`ready ${instance.url}`);
}

async function doctor() {
  const instance = await readInstance();
  const checks: [string, () => Promise<boolean> | boolean][] = [
    ["process is running", () => isRunning(instance.pid)],
    ["database container exists", () => containerExists(instance.containerId)],
    [
      "dev login page answers",
      async () => {
        const response = await fetch(new URL("dev/login", instance.url));
        return response.ok && (await response.text()).includes("Log in as");
      },
    ],
    [
      "fixture is seeded",
      async () => {
        const sql = new SQL(instance.databaseUrl);
        const [row] = await sql`select count(*)::int as count from users`;
        await sql.close();
        return row.count > 0;
      },
    ],
    // The instance doesn't reload, so code changed since start isn't what's being driven.
    ["instance runs the checked-out commit", () => instance.commit === currentCommit()],
  ];

  let healthy = true;
  for (const [name, check] of checks) {
    const passed = await Promise.resolve()
      .then(check)
      .catch(() => false);
    healthy &&= passed;
    console.log(`${passed ? "ok  " : "FAIL"} ${name}`);
  }
  console.log(`url ${instance.url}`);
  if (!healthy) process.exit(1);
}

async function runSql() {
  const instance = await readInstance();
  const sql = new SQL(instance.databaseUrl);
  const rows = await sql.unsafe(args.join(" "));
  await sql.close();
  console.log(JSON.stringify(rows, null, 2));
}

async function stop() {
  const instance = await readInstance();
  if (isRunning(instance.pid)) process.kill(instance.pid, "SIGTERM");
  const deadline = Date.now() + 30_000;
  while (isRunning(instance.pid) || containerExists(instance.containerId)) {
    if (Date.now() > deadline)
      throw new Error(`Instance ${instance.pid} or container ${instance.containerId} is still up`);
    await Bun.sleep(250);
  }
  console.log(`stopped. Evidence kept in ${join(runDirectory, "evidence")}`);
}

const commands: Record<string, () => Promise<void>> = { start, doctor, sql: runSql, stop };
await (commands[command] ?? exitWithUsage)();
