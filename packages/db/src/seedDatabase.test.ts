import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { asc, eq, sql } from "drizzle-orm";
import { createDatabase, rebuildDatabase } from "./client";
import { people } from "./fixtureData";
import {
  monthLocks,
  organizations,
  projectOrganizations,
  projects,
  timeEntries,
  timeEntriesExport,
  users,
} from "./schema";
import { seedDatabase, startOfLastMonth } from "./seedDatabase";
import { dayOf, Weekday } from "./week";

const database = createDatabase(process.env.DATABASE_URL ?? "");
// A fixed Wednesday, so the dates the fixture expands to are predictable.
const now = new Date("2026-10-14T12:00:00Z");

const unratedHours =
  sql`coalesce(sum(${timeEntriesExport.billableHours}) filter (where ${timeEntriesExport.amount} is null and ${projects.billing} = 'hourly'), 0)`.mapWith(
    Number,
  );

afterAll(() => database.$client.close());

describe("seeding", () => {
  beforeEach(() => rebuildDatabase(database));

  test("the fixture logs time in Norway and Sweden, with a rate for every hourly hour", async () => {
    await seedDatabase(database, { now });

    const [totals] = await database
      .select({
        accounts: sql<string[]>`array_agg(distinct ${timeEntriesExport.accountName})`,
        billableHours: sql`sum(${timeEntriesExport.billableHours})`.mapWith(Number),
        unratedHours,
      })
      .from(timeEntriesExport)
      .innerJoin(projects, eq(projects.code, timeEntriesExport.projectCode));
    expect(totals?.accounts.sort()).toEqual([
      "Variant Göteborg AB",
      "Variant Oslo AS",
      "Variant Stockholm AB",
      "Variant Trondheim AS",
    ]);
    expect(totals?.billableHours).toBeGreaterThan(0);
    expect(totals?.unratedHours).toBe(0);
  });

  test("a longer history reaches back before the recent weeks, still rating every hourly hour", async () => {
    await seedDatabase(database, { now, weeks: 30 });

    const [earliest] = await database
      .select({ spentOn: timeEntries.spentOn })
      .from(timeEntries)
      .orderBy(asc(timeEntries.spentOn))
      .limit(1);
    expect(earliest?.spentOn).toBe(dayOf(now, -30, Weekday.Monday));

    const [unrated] = await database
      .select({
        unratedHours,
      })
      .from(timeEntriesExport)
      .innerJoin(projects, eq(projects.code, timeEntriesExport.projectCode));
    expect(unrated?.unratedHours).toBe(0);
  });

  test("internal projects are open in their own countries, and leave in both", async () => {
    await seedDatabase(database, { now });

    const openCountries = await database
      .select({
        code: projects.code,
        countries: sql<
          string[]
        >`array_agg(distinct ${organizations.country} order by ${organizations.country})`,
      })
      .from(projectOrganizations)
      .innerJoin(projects, eq(projects.id, projectOrganizations.projectId))
      .innerJoin(organizations, eq(organizations.id, projectOrganizations.orgId))
      .where(eq(projectOrganizations.openToMembers, true))
      .groupBy(projects.code);
    const countriesOf = new Map(openCountries.map((row) => [row.code, row.countries]));
    expect(countriesOf.get("VAR1000")).toEqual(["NO"]);
    expect(countriesOf.get("INT1000")).toEqual(["SE"]);
    expect(countriesOf.get("FER1000")).toEqual(["NO", "SE"]);
  });

  test("a Swede on a Norwegian project logs time in the project's currency", async () => {
    await seedDatabase(database, { now });

    const currencies = await database
      .selectDistinct({ currency: timeEntries.currency })
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.userId))
      .where(eq(users.email, "maja.holm@example.com"));
    expect(currencies).toEqual([{ currency: "NOK" }]);
  });

  test("the fixture locks last month in Trondheim and leaves Oslo open", async () => {
    await seedDatabase(database, { now });

    const locks = await database
      .select({ organization: organizations.slug, month: monthLocks.month })
      .from(monthLocks)
      .innerJoin(organizations, eq(organizations.id, monthLocks.orgId));
    expect(locks).toEqual([{ organization: "trondheim", month: "2026-09-01" }]);
  });

  test("extra people seed more users without losing the hand-written ones", async () => {
    await seedDatabase(database, { now, extraPeople: 20 });
    expect(await database.$count(users)).toBe(people.length + 20);
  });
});

test("startOfLastMonth steps back across the year boundary", () => {
  expect(startOfLastMonth(new Date("2026-10-14T00:00:00Z"))).toBe("2026-09-01");
  expect(startOfLastMonth(new Date("2026-01-05T00:00:00Z"))).toBe("2025-12-01");
});

test("startOfLastMonth goes by the month in Oslo", () => {
  // 31 October 23:30 UTC is already 1 November in Oslo.
  expect(startOfLastMonth(new Date("2026-10-31T23:30:00Z"))).toBe("2026-10-01");
});
