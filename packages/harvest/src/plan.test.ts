import { afterAll, beforeAll, expect, test } from "bun:test";
import { createDatabase, rebuildDatabase } from "@tid/db/client";
import { organizations, timeEntriesExport, userRoles, users } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { HarvestExport } from "./harvestExport";
import type { KnownOrganization } from "./organizations";
import { planImport } from "./plan";
import { describeWarning } from "./report";
import { writePlan } from "./write";

// The test preload points DATABASE_URL at a throwaway container.
const database = createDatabase(process.env.DATABASE_URL ?? "");

// The organizations the migrations add, which accounts are matched to.
let known: KnownOrganization[];

beforeAll(async () => {
  await rebuildDatabase(database);
  known = await database.select().from(organizations);
});
afterAll(() => database.$client.close());

const project = (
  id: number,
  code: string,
  client = "Kunde AS",
): HarvestExport["projects"][number] => ({
  id,
  code,
  name: `Project ${code}`,
  is_active: true,
  is_billable: client !== "Varianttid",
  is_fixed_fee: false,
  bill_by: client !== "Varianttid" ? "People" : "none",
  hourly_rate: null,
  starts_on: null,
  ends_on: null,
  client: { name: client, currency: "NOK" },
});

const user = (id: number, email: string, accessRoles = ["member"]) => ({
  id,
  first_name: "Kari",
  last_name: "Nordmann",
  email,
  is_active: true,
  access_roles: accessRoles,
  default_hourly_rate: null,
});

const assignment = (userId: number, projectId: number, rate: number | null = 1600) => ({
  project: { id: projectId },
  user: { id: userId },
  use_default_rates: false,
  hourly_rate: rate,
  created_at: "2026-07-01T08:00:00Z",
});

const taskAssignment = (projectId: number, task: string, rate: number | null, billable = true) => ({
  project: { id: projectId },
  task: { name: task },
  billable,
  hourly_rate: rate,
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
  users: [user(10, "Kari@example.com")],
  projects: [project(100, "KUN1001"), project(101, "VAR1000", "Varianttid")],
  userAssignments: [assignment(10, 100)],
  taskAssignments: [],
  timeEntries: [
    entry(10, 100, "2026-08-03", 4),
    entry(10, 100, "2026-08-03", 3.5),
    entry(10, 100, "2026-08-04", 7.5, 1600),
    entry(10, 101, "2026-08-05", 7.5, null, "Variantdag"),
  ],
};

const oslo: HarvestExport = {
  account: { id: 2, name: "Variant Oslo AS" },
  users: [user(20, "kari@example.com")],
  projects: [project(200, "KUN1001")],
  userAssignments: [assignment(20, 200)],
  taskAssignments: [],
  timeEntries: [entry(20, 200, "2026-08-06", 2, 1600)],
};

test("accounts must match an organization by name and currency", () => {
  const { problems } = planImport(
    [
      { ...trondheim, account: { id: 3, name: "Variant Øst AS" } },
      {
        ...oslo,
        projects: [{ ...project(200, "KUN1001"), client: { name: "Kunde AS", currency: "SEK" } }],
      },
    ],
    known,
  );

  expect(problems).toEqual([
    "Variant Øst AS: no organization has this name; add it in a migration.",
    "Variant Oslo AS: has clients in SEK, but the organization uses NOK.",
  ]);
});

test("merges people and projects across accounts, and keeps each entry's own rate", () => {
  const { plan, problems, warnings } = planImport([trondheim, oslo], known);

  expect(problems).toEqual([]);
  expect(warnings.map(describeWarning)).toEqual([
    "Kari@example.com is in trondheim and oslo; placed in trondheim, where they work the most.",
  ]);
  expect(plan.users).toEqual([
    {
      email: "Kari@example.com",
      name: "Kari Nordmann",
      organization: "trondheim",
      manager: false,
      harvestRoles: ["member"],
    },
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
      // Harvest only knows today's rate; older ones live on the entries.
      rates: [{ validFrom: "2026-07-01", rate: 160000 }],
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
    timeEntries: [entry(99, 100, "2026-08-04", 1)],
  };
  const { problems } = planImport([broken], known);

  expect(problems).toEqual([
    'Variant Trondheim AS: project "Uten kode" has no code.',
    "Variant Trondheim AS: an entry on 2026-08-04 has an unknown user.",
  ]);
});

test("vacation and paid welfare leave don't count toward billable base hours", () => {
  const { plan } = planImport(
    [
      {
        ...trondheim,
        projects: [
          ...trondheim.projects,
          project(102, "FER1000", "Varianttid"),
          project(103, "VEL1000", "Varianttid"),
        ],
      },
    ],
    known,
  );

  const countsTowardBase = (code: string) =>
    plan.projects.find((p) => p.code === code)?.countsTowardBillableBase;
  expect(countsTowardBase("KUN1001")).toBe(true);
  expect(countsTowardBase("VAR1000")).toBe(true);
  expect(countsTowardBase("FER1000")).toBe(false);
  expect(countsTowardBase("VEL1000")).toBe(false);
});

// A plan without problems must be one Postgres accepts, or the import fails halfway.
test("a plan without problems is written and exported as Harvest had it", async () => {
  const { plan, problems } = planImport([trondheim, oslo], known);
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
  const { plan, problems, warnings } = planImport([withSuffix], known);

  expect(problems).toEqual([]);
  expect(warnings).toEqual([]);
  expect(plan.projects).toMatchObject([{ code: "KUN1001", name: "Kvalitetssystem" }]);
  expect(plan.entries.map((e) => e.project)).toEqual(["KUN1001", "KUN1001"]);
});

test("the contract owner is suggested when one account has the project, or -S marks it", () => {
  const subcontracted: HarvestExport = {
    ...oslo,
    projects: [project(200, "KUN1001-S"), project(201, "KUN1002")],
  };
  // Oslo has subcontractors from Trondheim on KUN1001.
  const suggestions = (exports: HarvestExport[]) =>
    Object.fromEntries(
      planImport(exports, known).plan.projects.map((p) => [p.code, p.suggestedOwner]),
    );

  expect(suggestions([trondheim, oslo])).toEqual({
    KUN1001: null,
    VAR1000: null,
  });
  expect(suggestions([trondheim, subcontracted])).toEqual({
    KUN1001: "oslo",
    KUN1002: "oslo",
    VAR1000: null,
  });
});

test("fixed fee projects are billable, and their time keeps no rate", () => {
  const fixedFee: HarvestExport = {
    ...trondheim,
    projects: [{ ...project(100, "KUN1001"), is_fixed_fee: true }],
    timeEntries: [entry(10, 100, "2026-08-03", 4, 1500)],
  };
  const { plan, problems, warnings } = planImport([fixedFee], known);

  expect(problems).toEqual([]);
  expect(warnings).toEqual([]);
  expect(plan.projects).toMatchObject([{ code: "KUN1001", billing: "fixed_fee" }]);
  expect(plan.assignments).toMatchObject([{ project: "KUN1001", rates: [] }]);
  expect(plan.entries).toMatchObject([{ project: "KUN1001", rate: null, currency: null }]);
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
  const { plan, problems, warnings } = planImport([twoCodes], known);

  expect(problems).toEqual([]);
  expect(warnings.map(describeWarning)).toContain(
    'Kunde AS has several projects named "Kvalitetssystem" (KUN1001, KUN1002); each gets its code added to the name.',
  );
  expect(plan.projects.map((p) => p.name)).toEqual([
    "Kvalitetssystem (KUN1001)",
    "Kvalitetssystem (KUN1002)",
  ]);

  await rebuildDatabase(database);
  await writePlan(database, plan);
});

test("an assignment's rate comes from wherever Harvest bills the project", () => {
  const billing: HarvestExport = {
    ...trondheim,
    users: [
      { ...user(10, "Kari@example.com"), default_hourly_rate: 1300 },
      user(11, "per@example.com"),
      user(12, "ola@example.com"),
    ],
    projects: [
      { ...project(100, "KUN1001"), bill_by: "Project", hourly_rate: 1400 },
      { ...project(101, "KUN1002"), bill_by: "Tasks" },
      project(102, "KUN1003"),
      project(103, "KUN1004"),
      { ...project(104, "KUN1005"), bill_by: "none", is_fixed_fee: true },
      project(105, "KUN1006"),
      { ...project(106, "KUN1007"), bill_by: "Tasks" },
    ],
    userAssignments: [
      assignment(10, 100, null),
      assignment(10, 101, null),
      { ...assignment(10, 102, 9999), use_default_rates: true },
      assignment(10, 103, 1700),
      // Harvest's budget rate on a fixed fee project isn't a billing rate, so it's dropped.
      assignment(10, 104, 1500),
      assignment(10, 105, null),
      assignment(10, 106, null),
      assignment(11, 106, null),
      assignment(12, 106, null),
    ],
    // Non-billable tasks don't count toward the project's rate.
    taskAssignments: [
      taskAssignment(101, "Utvikling", 1500),
      taskAssignment(101, "Internt", 900, false),
    ],
    timeEntries: [
      entry(10, 106, "2026-08-03", 4, 1000, "Nivå 1"),
      entry(10, 106, "2026-08-10", 4, 1270, "Nivå 2"),
      entry(12, 106, "2026-08-03", 4, 1270, "Nivå 2"),
      entry(12, 106, "2026-08-04", 4, 1000, "Nivå 1"),
    ],
  };
  billing.taskAssignments.push(
    taskAssignment(106, "Nivå 1", 1000),
    taskAssignment(106, "Nivå 2", 1270),
  );
  const { plan, problems, warnings } = planImport([billing], known);

  expect(problems).toEqual([]);
  expect(warnings.map(describeWarning)).toEqual([
    "ola@example.com was billed at 1270, 1000 on project KUN1007, not as a price increase; they keep the last, 1000.",
    "Kari@example.com has no rate on project KUN1006, so their hours export without an amount.",
    "per@example.com has no rate on project KUN1007, so their hours export without an amount.",
  ]);
  // Only the project priced per task gets the advice to bill per consultant instead.
  expect(
    warnings.flatMap((w) =>
      w.kind.startsWith("noRate") && "project" in w ? [[w.kind, w.project]] : [],
    ),
  ).toEqual([
    ["noRate", "KUN1006"],
    ["noRatePricedByTask", "KUN1007"],
  ]);
  expect(
    Object.fromEntries(
      plan.assignments
        .filter((a) => a.email === "Kari@example.com")
        .map((a) => [a.project, a.rates.map((r) => r.rate)]),
    ),
  ).toEqual({
    KUN1001: [140000],
    KUN1002: [150000],
    KUN1003: [130000],
    KUN1004: [170000],
    KUN1005: [],
    KUN1006: [],
    // Priced per task: the rate of the task last logged on.
    KUN1007: [127000],
  });
});

test("everyone who may log time today is brought in, with or without history", async () => {
  const today: HarvestExport = {
    ...trondheim,
    users: [
      user(10, "Kari@example.com", ["manager", "project_creator"]),
      user(11, "per@example.com", ["administrator"]),
      user(13, "lise@example.com", ["project_manager"]),
      // Inactive people are only fetched for the history they logged.
      { ...user(12, "ola@example.com"), is_active: false },
    ],
    projects: [project(100, "KUN1001"), { ...project(101, "KUN1002"), is_active: false }],
    userAssignments: [assignment(11, 100), assignment(11, 101), assignment(12, 100)],
    taskAssignments: [taskAssignment(100, "Utvikling", null)],
    timeEntries: [],
  };
  const { plan, problems } = planImport([today], known);

  expect(problems).toEqual([]);
  expect(plan.users.map((u) => [u.email, u.manager])).toEqual([
    ["Kari@example.com", true],
    ["per@example.com", true],
    ["lise@example.com", true],
    ["ola@example.com", false],
  ]);
  expect(plan.assignments.map((a) => [a.project, a.email])).toEqual([
    ["KUN1001", "per@example.com"],
  ]);
  expect(plan.tasks).toEqual([{ project: "KUN1001", name: "Utvikling" }]);

  await rebuildDatabase(database);
  await writePlan(database, plan);
  const managers = await database
    .select({ email: users.email })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId));
  expect(managers).toEqual([
    { email: "Kari@example.com" },
    { email: "per@example.com" },
    { email: "lise@example.com" },
  ]);
});
