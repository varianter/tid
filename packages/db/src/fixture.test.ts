import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDatabase, rebuildDatabase } from "./client";
import { seedDatabase } from "./fixture";
import { timeEntriesExport } from "./schema";

const database = createDatabase(process.env.DATABASE_URL ?? "");

beforeAll(() => rebuildDatabase(database));
afterAll(() => database.$client.close());

test("the fixture logs time in Oslo and Trondheim, with a rate for every billable hour", async () => {
  await seedDatabase(database);

  const [totals] = await database
    .select({
      accounts: sql<string[]>`array_agg(distinct ${timeEntriesExport.accountName})`,
      billableHours: sql`sum(${timeEntriesExport.billableHours})`.mapWith(Number),
      unratedHours:
        sql`coalesce(sum(${timeEntriesExport.billableHours}) filter (where ${timeEntriesExport.amount} is null), 0)`.mapWith(
          Number,
        ),
    })
    .from(timeEntriesExport);
  expect(totals?.accounts.sort()).toEqual(["Variant Oslo AS", "Variant Trondheim AS"]);
  expect(totals?.billableHours).toBeGreaterThan(0);
  expect(totals?.unratedHours).toBe(0);
});
