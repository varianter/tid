// Rebuilds the dev database from the Norwegian Harvest accounts, so the app can be checked
// against real data.
// Usage: bun run harvest:import:norway [from-month [to-month]] --tokens <token>,<token> [--save] [--verbose]
// Each token is a Harvest personal access token; every account they reach is imported. Without
// months, only today's state is imported, without time entries.

import { parseArgs } from "node:util";
import { closeOtherConnections, createDatabase, rebuildDatabase } from "@tid/db/client";
import { startDevelopmentDatabase } from "@tid/db/container";
import { organizations, timeEntries } from "@tid/db/schema";
import { sql } from "drizzle-orm";
import { fetchHarvestAccounts } from "../src/fetch";
import { planImport, suggestedOwners } from "../src/plan";
import { describePlan, describeWarning } from "../src/report";
import { describeRejection, writePlan } from "../src/write";

function exitWith(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const { values: options, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    tokens: { type: "string" },
    save: { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
  },
  allowPositionals: true,
});
const [fromMonth, toMonth = fromMonth] = positionals;
const isMonth = (value?: string) => value !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
if (
  fromMonth !== undefined &&
  (!isMonth(fromMonth) || !isMonth(toMonth) || (toMonth as string) < fromMonth)
) {
  exitWith(
    "Usage: bun run harvest:import:norway [from-month [to-month]] --tokens <token>,<token> [--save] [--verbose], with months as YYYY-MM.",
  );
}
const lastDayOf = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return `${month}-${new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()}`;
};
const period =
  fromMonth === undefined
    ? undefined
    : { from: `${fromMonth}-01`, to: lastDayOf(toMonth as string) };

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

console.log(
  `Fetching ${period ? `${period.from} to ${period.to}` : "today's state"} with ${Object.keys(tokens).length} tokens`,
);
const harvestExports = await fetchHarvestAccounts(tokens, period).catch((error: Error) =>
  exitWith(error.message),
);
for (const { account, timeEntries, users, projects } of harvestExports) {
  console.log(
    `  ${account.name}: ${timeEntries.length} entries, ${users.length} users, ${projects.length} projects`,
  );
}
if (options.save) {
  const directory = `${import.meta.dir}/../harvest-export/${fromMonth ? `${fromMonth}..${toMonth}` : "today"}`;
  for (const harvestExport of harvestExports) {
    await Bun.write(
      `${directory}/${harvestExport.account.id}.json`,
      JSON.stringify(harvestExport, null, 2),
    );
  }
  console.log(`Saved to ${directory}`);
}

// Rebuilt first, since accounts are matched to the organizations the migrations add, and
// migrating a database built from older migrations fails.
const container = await startDevelopmentDatabase();
const database = createDatabase(container.getConnectionUri());
await closeOtherConnections(database);
await rebuildDatabase(database);
const { plan, problems, warnings } = planImport(
  harvestExports,
  await database.select().from(organizations),
);
if (options.verbose) console.log(`\n${describePlan(plan)}`);
if (warnings.length > 0) {
  console.log(`\n${warnings.length} warnings:`);
  for (const warning of warnings) console.log(`  ! ${describeWarning(warning)}`);
}
if (problems.length > 0) {
  console.error(`\n${problems.length} problems:`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  exitWith("Nothing was imported; the dev database is now empty.");
}

await writePlan(database, plan, { owners: suggestedOwners(plan) }).catch((error) =>
  exitWith(
    `Postgres rejected the import, so the dev database is now empty:\n  ${describeRejection(error)}`,
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

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
// Every account matched the organization with its name, or the import would have stopped.
const organizationCount = new Set(harvestExports.map(({ account }) => account.name)).size;
console.log(
  `\n✓ Imported ${plural(harvestExports.length, "Harvest account")}, converted into ` +
    `${plural(organizationCount, "Tid organization")}: ${plural(plan.entries.length, "time entry")} ` +
    `(${(plannedMinutes / 60).toFixed(2)} hours), ${plural(plan.users.length, "user")} and ` +
    `${plural(plan.projects.length, "project")}.`,
);
