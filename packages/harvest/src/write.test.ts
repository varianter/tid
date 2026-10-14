import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { createDatabase, rebuildDatabase } from "@tid/db/client";
import { assignmentRates, organizations, projects, users } from "@tid/db/schema";
import { eq, sql } from "drizzle-orm";
import type { ImportPlan } from "./plan";
import { writePlan } from "./write";

// The test preload points DATABASE_URL at a throwaway container.
const database = createDatabase(process.env.DATABASE_URL ?? "");

beforeAll(() => rebuildDatabase(database));
// Rebuilding between tests would change type ids under this connection's prepared statements.
beforeEach(async () => {
  await database.execute(sql`truncate users, clients cascade`);
});
afterAll(() => database.$client.close());

const plan: ImportPlan = {
  users: [
    {
      email: "kari@example.com",
      name: "Kari Nordmann",
      organization: "trondheim",
      manager: true,
      harvestRoles: ["manager"],
    },
  ],
  clients: ["Kunde AS"],
  projects: [
    {
      code: "KUN1001",
      client: "Kunde AS",
      name: "Kvalitetssystem",
      billable: true,
      openToEveryone: false,
      countsTowardBillableBase: true,
      startsOn: null,
      endsOn: null,
      organizations: ["trondheim"],
    },
  ],
  tasks: [{ project: "KUN1001", name: "Utvikling" }],
  assignments: [
    {
      project: "KUN1001",
      email: "kari@example.com",
      rates: [{ validFrom: "2026-07-01", rate: 160000 }],
    },
  ],
  entries: [
    {
      email: "kari@example.com",
      project: "KUN1001",
      task: "Utvikling",
      spentOn: "2026-08-03",
      minutes: 450,
      notes: null,
      rate: 160000,
      currency: "NOK",
    },
  ],
};

test("a preview reports what would be added, and writes nothing", async () => {
  const { added, differences } = await writePlan(database, plan, { preview: true });

  expect(added).toMatchObject({
    users: ["kari@example.com"],
    projects: ["KUN1001"],
    participations: ["KUN1001 trondheim"],
    assignments: ["KUN1001 kari@example.com"],
    rates: ["KUN1001 kari@example.com"],
    entries: ["kari@example.com KUN1001 Utvikling 2026-08-03"],
  });
  expect(differences).toEqual([]);
  expect(await database.select().from(users)).toEqual([]);
});

test("writing the same plan again adds nothing", async () => {
  await writePlan(database, plan);
  const { added, differences } = await writePlan(database, plan);

  expect(Object.values(added).flat()).toEqual([]);
  expect(differences).toEqual([]);
});

test("what changed in Tid is kept, unless the difference is accepted", async () => {
  await writePlan(database, plan);
  await database.update(projects).set({ name: "Nytt navn" });
  await database.update(assignmentRates).set({ rate: 170000 });

  const kept = await writePlan(database, plan);
  expect(kept.differences).toEqual([
    {
      id: "project|KUN1001|name",
      kind: "project",
      row: "KUN1001",
      field: "name",
      tid: "Nytt navn",
      harvest: "Kvalitetssystem",
    },
    {
      id: "rate|KUN1001 kari@example.com|rate",
      kind: "rate",
      row: "KUN1001 kari@example.com",
      field: "rate",
      tid: "1700",
      harvest: "1600",
    },
  ]);
  expect((await database.select().from(projects))[0]?.name).toBe("Nytt navn");

  await writePlan(database, plan, {
    accepted: new Set(["project|KUN1001|name", "rate|KUN1001 kari@example.com|rate"]),
  });
  expect((await database.select().from(projects))[0]?.name).toBe("Kvalitetssystem");
  // Harvest's rate applies from today, so time logged at Tid's rate keeps it.
  const rates = await database
    .select({ validFrom: assignmentRates.validFrom, rate: assignmentRates.rate })
    .from(assignmentRates)
    .orderBy(assignmentRates.validFrom);
  expect(rates.map((row) => row.rate)).toEqual([170000, 160000]);
  expect(rates[0]?.validFrom).toBe("2026-07-01");
});

test("a user's organization in Tid is kept, and their assignments go through it", async () => {
  await writePlan(database, { ...plan, assignments: [], entries: [] });
  const [oslo] = await database.select().from(organizations).where(eq(organizations.slug, "oslo"));
  await database.update(users).set({ orgId: oslo?.id });

  const { added, differences } = await writePlan(database, plan);
  expect(differences.map((difference) => difference.id)).toEqual([
    "user|kari@example.com|organization",
  ]);
  expect(added.participations).toEqual(["KUN1001 oslo"]);
});
