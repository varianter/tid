import { afterAll, beforeAll, expect, test } from "bun:test";
import { createDatabase, rebuildDatabase } from "../client";
import { timeEntriesExport } from "../schema";
import { type HarvestExport, organizationSlug, planImport } from "./plan";
import { writePlan } from "./write";

// The test preload points DATABASE_URL at a throwaway container.
const database = createDatabase(process.env.DATABASE_URL ?? "");

beforeAll(() => rebuildDatabase(database));
afterAll(() => database.$client.close());

const project = (id: number, code: string, client = "Kunde AS") => ({
  id,
  code,
  name: `Project ${code}`,
  is_billable: client !== "Varianttid",
  starts_on: null,
  ends_on: null,
  client: { name: client },
});

const entry = (
  userId: number,
  projectId: number,
  spentDate: string,
  hours: number,
  rate: number | null = 1500,
  task = "Utvikling",
) => ({
  spent_date: spentDate,
  hours,
  notes: null,
  billable: rate !== null,
  billable_rate: rate,
  user: { id: userId },
  client: { currency: "NOK" },
  project: { id: projectId },
  task: { name: task },
});

const trondheim: HarvestExport = {
  account: { id: 1, name: "Variant Trondheim AS" },
  users: [{ id: 10, first_name: "Kari", last_name: "Nordmann", email: "Kari@example.com" }],
  projects: [project(100, "KUN1001"), project(101, "VAR1000", "Varianttid")],
  timeEntries: [
    entry(10, 100, "2026-08-03", 4),
    entry(10, 100, "2026-08-03", 3.5),
    entry(10, 100, "2026-08-04", 7.5, 1600),
    entry(10, 101, "2026-08-05", 7.5, null, "Variantdag"),
  ],
};

const oslo: HarvestExport = {
  account: { id: 2, name: "Variant Oslo AS" },
  users: [{ id: 20, first_name: "Kari", last_name: "Nordmann", email: "kari@example.com" }],
  projects: [project(200, "KUN1001")],
  timeEntries: [entry(20, 200, "2026-08-06", 2, 1600)],
};

test("account names become short slugs", () => {
  expect(organizationSlug("Variant Trondheim AS")).toBe("trondheim");
  expect(organizationSlug("Variant Øst AS")).toBe("st");
});

test("merges people and projects across accounts, and copies each entry's rate", () => {
  const { plan, problems, warnings } = planImport([trondheim, oslo]);

  expect(problems).toEqual([]);
  expect(warnings).toEqual([
    "Kari@example.com logs time in trondheim and oslo; placed in trondheim, where they log the most.",
  ]);
  expect(plan.users).toEqual([
    { email: "Kari@example.com", name: "Kari Nordmann", organization: "trondheim" },
  ]);
  expect(plan.projects.find((p) => p.code === "KUN1001")?.organizations).toEqual([
    "trondheim",
    "oslo",
  ]);
  expect(plan.projects.find((p) => p.code === "VAR1000")?.openToEveryone).toBe(true);
  expect(plan.assignments).toEqual([
    {
      project: "KUN1001",
      email: "Kari@example.com",
      rates: [
        { validFrom: "2026-08-03", rate: 150000 },
        { validFrom: "2026-08-04", rate: 160000 },
      ],
    },
  ]);
  expect(plan.entries.find((e) => e.spentOn === "2026-08-03")).toMatchObject({
    minutes: 450,
    rate: 150000,
    currency: "NOK",
  });
  expect(plan.entries.find((e) => e.project === "VAR1000")).toMatchObject({
    rate: null,
    currency: null,
  });
});

test("reports every problem instead of stopping at the first", () => {
  const broken: HarvestExport = {
    ...trondheim,
    projects: [project(100, "KUN1001"), { ...project(101, ""), name: "Uten kode" }],
    timeEntries: [
      entry(10, 100, "2026-08-03", 4, 1500, "Utvikling"),
      entry(10, 100, "2026-08-03", 3.5, 1800, "Rådgivning"),
      entry(99, 100, "2026-08-04", 1),
    ],
  };
  const { problems } = planImport([broken]);

  expect(problems).toEqual([
    'Variant Trondheim AS: project "Uten kode" has no code.',
    "Variant Trondheim AS: an entry on 2026-08-04 has an unknown user.",
    "Variant Trondheim AS: Kari@example.com has several rates on project KUN1001 on 2026-08-03 " +
      "(1500, 1800), probably one per task. Split the project into one per rate.",
  ]);
});

test("vacation and paid welfare leave don't count toward billable base hours", () => {
  const { plan } = planImport([
    {
      ...trondheim,
      projects: [
        ...trondheim.projects,
        project(102, "FER1000", "Varianttid"),
        project(103, "VEL1000", "Varianttid"),
      ],
    },
  ]);

  const countsTowardBase = (code: string) =>
    plan.projects.find((p) => p.code === code)?.countsTowardBillableBase;
  expect(countsTowardBase("KUN1001")).toBe(true);
  expect(countsTowardBase("VAR1000")).toBe(true);
  expect(countsTowardBase("FER1000")).toBe(false);
  expect(countsTowardBase("VEL1000")).toBe(false);
});

// A plan without problems must be one Postgres accepts, or the import fails halfway.
test("a plan without problems is written and exported as Harvest had it", async () => {
  const { plan, problems } = planImport([trondheim, oslo]);
  expect(problems).toEqual([]);

  await writePlan(database, plan);

  const rows = await database
    .select({
      accountName: timeEntriesExport.accountName,
      spentDate: timeEntriesExport.spentDate,
      projectCode: timeEntriesExport.projectCode,
      hours: timeEntriesExport.hours,
      billableRate: timeEntriesExport.billableRate,
    })
    .from(timeEntriesExport)
    .orderBy(timeEntriesExport.spentDate);
  expect(rows).toEqual([
    {
      accountName: "Variant Trondheim AS",
      spentDate: "2026-08-03",
      projectCode: "KUN1001",
      hours: "7.50",
      billableRate: "1500.00",
    },
    {
      accountName: "Variant Trondheim AS",
      spentDate: "2026-08-04",
      projectCode: "KUN1001",
      hours: "7.50",
      billableRate: "1600.00",
    },
    {
      accountName: "Variant Trondheim AS",
      spentDate: "2026-08-05",
      projectCode: "VAR1000",
      hours: "7.50",
      billableRate: null,
    },
    {
      accountName: "Variant Trondheim AS",
      spentDate: "2026-08-06",
      projectCode: "KUN1001",
      hours: "2.00",
      billableRate: "1600.00",
    },
  ]);
});

test("a -S code is merged into its base code", () => {
  const withSuffix: HarvestExport = {
    ...trondheim,
    projects: [
      { ...project(100, "KUN1001"), name: "Kvalitetssystem" },
      { ...project(101, "KUN1001-S"), name: "Kvalitetssystem" },
    ],
    timeEntries: [entry(10, 100, "2026-08-03", 4), entry(10, 101, "2026-08-04", 4)],
  };
  const { plan, problems, warnings } = planImport([withSuffix]);

  expect(problems).toEqual([]);
  expect(warnings).toEqual([]);
  expect(plan.projects).toMatchObject([{ code: "KUN1001", name: "Kvalitetssystem" }]);
  expect(plan.entries.map((e) => e.project)).toEqual(["KUN1001", "KUN1001"]);
});

test("projects sharing a name under one client get their codes added, so Postgres accepts them", async () => {
  const twoCodes: HarvestExport = {
    ...trondheim,
    projects: [
      { ...project(100, "KUN1001"), name: "Kvalitetssystem" },
      { ...project(101, "KUN1002"), name: "Kvalitetssystem" },
    ],
    timeEntries: [entry(10, 100, "2026-08-03", 4), entry(10, 101, "2026-08-04", 4)],
  };
  const { plan, problems, warnings } = planImport([twoCodes]);

  expect(problems).toEqual([]);
  expect(warnings).toContain(
    'Kunde AS has several projects named "Kvalitetssystem" (KUN1001, KUN1002); each gets its code added to the name.',
  );
  expect(plan.projects.map((p) => p.name)).toEqual([
    "Kvalitetssystem (KUN1001)",
    "Kvalitetssystem (KUN1002)",
  ]);

  await rebuildDatabase(database);
  await writePlan(database, plan);
});
