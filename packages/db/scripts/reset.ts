import { parseArgs } from "node:util";
import { closeOtherConnections, createDatabase, rebuildDatabase } from "../src/client";
import { startDevelopmentDatabase } from "../src/container";
import { seedDatabase } from "../src/seedDatabase";

// Resets to a few realistic recent weeks by default. Pass --years 5 (or --weeks 260) and
// --people 1000 to fill a longer, denser history for performance testing.
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { years: { type: "string" }, weeks: { type: "string" }, people: { type: "string" } },
});
const number = (value: string | undefined) => (value === undefined ? undefined : Number(value));
const years = number(values.years);
const weeks = years === undefined ? number(values.weeks) : years * 52;

const container = await startDevelopmentDatabase();
const database = createDatabase(container.getConnectionUri());
await closeOtherConnections(database);
await rebuildDatabase(database);
await seedDatabase(database, { weeks, extraPeople: number(values.people) });
await database.$client.close();
console.log("Development database reset to the fixture");
