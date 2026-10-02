// Rebuilds the dev database from Harvest, so the app can be checked against real data.
// Usage: bun run db:import <from-month> [to-month] --tokens <token>,<token> [--save]
// Each token is a Harvest personal access token; every account they reach is imported.

import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { createDatabase, rebuildDatabase } from "../src/client";
import { startDevelopmentDatabase } from "../src/container";
import { fetchHarvestAccounts } from "../src/harvest/fetch";
import { planImport } from "../src/harvest/plan";
import { writePlan } from "../src/harvest/write";
import { timeEntries } from "../src/schema";

function exitWith(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const { values: options, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: { tokens: { type: "string" }, save: { type: "boolean", default: false } },
  allowPositionals: true,
});
const [fromMonth, toMonth = fromMonth] = positionals;
const isMonth = (value?: string) => value !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
if (!isMonth(fromMonth) || !isMonth(toMonth) || (toMonth as string) < (fromMonth as string)) {
  exitWith(
    "Usage: bun run db:import <from-month> [to-month] --tokens <token>,<token> [--save], with months as YYYY-MM.",
  );
}
const [toYear, toMonthNumber] = (toMonth as string).split("-").map(Number) as [number, number];
const from = `${fromMonth}-01`;
const to = `${toMonth}-${new Date(Date.UTC(toYear, toMonthNumber, 0)).getUTCDate()}`;

// Named by position, so errors can say which token failed without printing it.
const tokens = Object.fromEntries(
  (options.tokens ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token, index) => [`token ${index + 1}`, token]),
);
if (Object.keys(tokens).length === 0) {
  exitWith("No Harvest tokens. Pass one per organization, like --tokens <token>,<token>.");
}

console.log(`Fetching ${from} to ${to} with ${Object.keys(tokens).length} tokens`);
const harvestExports = await fetchHarvestAccounts(tokens, from, to).catch((error: Error) =>
  exitWith(error.message),
);
for (const { account, timeEntries, users, projects } of harvestExports) {
  console.log(
    `  ${account.name}: ${timeEntries.length} entries, ${users.length} users, ${projects.length} projects`,
  );
}
if (options.save) {
  const directory = `${import.meta.dir}/../harvest-export/${fromMonth}..${toMonth}`;
  for (const harvestExport of harvestExports) {
    await Bun.write(
      `${directory}/${harvestExport.account.id}.json`,
      JSON.stringify(harvestExport, null, 2),
    );
  }
  console.log(`Saved to ${directory}`);
}

const { plan, problems, warnings } = planImport(harvestExports);
if (warnings.length > 0) {
  console.log(`\n${warnings.length} warnings:`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
}
if (problems.length > 0) {
  console.error(`\n${problems.length} problems:`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  exitWith("Nothing was imported; the dev database is unchanged.");
}

// Drizzle wraps the driver's error, which holds what Postgres said and why.
function describeDatabaseError(error: unknown) {
  const cause = (error as { cause?: Record<string, unknown> }).cause ?? {};
  const details = [
    cause.message,
    cause.detail,
    cause.constraint && `constraint ${cause.constraint}`,
  ];
  return details.filter(Boolean).join("\n  ") || String(error);
}

const container = await startDevelopmentDatabase();
const database = createDatabase(container.getConnectionUri());
await rebuildDatabase(database);
await writePlan(database, plan).catch((error) =>
  exitWith(
    `Postgres rejected the import, so the dev database is now empty:\n  ${describeDatabaseError(error)}`,
  ),
);

// Guards against entries silently lost or merged by the mapping.
const [stored] = await database
  .select({ minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int` })
  .from(timeEntries);
const plannedMinutes = plan.entries.reduce((total, entry) => total + entry.minutes, 0);
await database.$client.close();
if (stored?.minutes !== plannedMinutes) {
  exitWith(`Stored ${stored?.minutes} minutes, but Harvest had ${plannedMinutes}.`);
}

console.log(
  `\n✓ Imported ${plan.entries.length} time entries (${(plannedMinutes / 60).toFixed(2)} hours), ` +
    `${plan.users.length} users and ${plan.projects.length} projects from ${plan.organizations.length} organizations.`,
);
