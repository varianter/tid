import { sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  assignmentRates,
  clients,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  userRoles,
  users,
} from "./schema";

// Fictional people on fictional customers, shaped after a month of real Harvest data: mostly
// 7.5-hour days on one customer, internal time for leave and between projects, few notes.
// Weeks are relative to the current one (0), so the data stays recent whenever it's seeded.

const firstWeek = -17;

type OrganizationSlug = "trondheim" | "oslo";

const organizationCatalog: Record<OrganizationSlug, string> = {
  trondheim: "Variant Trondheim AS",
  oslo: "Variant Oslo AS",
};

type ProjectDefinition = {
  name: string;
  client: string;
  owner: OrganizationSlug;
  billable: boolean;
  countsTowardBillableBase?: boolean;
  endsWeek?: number;
};

const internal = { client: "Varianttid", owner: "trondheim", billable: false } as const;

// Varianttid's internal projects are copied from Harvest. Customer projects are made up, with
// codes shaped like the real ones; a suffix splits a project that bills at a different rate.
const projectCatalog = {
  VAR1000: { ...internal, name: "Variantdrift" },
  VAR1001: { ...internal, name: "Variantdrift - Admin" },
  VAR1099: { ...internal, name: "Variantdrift - mellom prosjekter" },
  VAR2000: { ...internal, name: "Renhold" },
  VEL1000: { ...internal, name: "Velferdspermisjoner med lønn", countsTowardBillableBase: false },
  VEL1001: { ...internal, name: "Velferdspermisjoner fra NAV samt permisjon uten lønn" },
  SYK1000: { ...internal, name: "Sykefravær - korttids" },
  FER1000: { ...internal, name: "Ferie", countsTowardBillableBase: false },
  LYS1001: { name: "Kundeportal", client: "Lysning Energi AS", owner: "trondheim", billable: true },
  BOL1001: {
    name: "Ruteplanlegger",
    client: "Bølge Transport AS",
    owner: "trondheim",
    billable: true,
  },
  GRA1001: {
    name: "Innbyggertjenester",
    client: "Granlia kommune",
    owner: "trondheim",
    billable: true,
    endsWeek: -9,
  },
  FJA1001: { name: "Pasientreise", client: "Fjære Helse AS", owner: "trondheim", billable: true },
  KVI1001: { name: "Nettbank", client: "Kvist Bank ASA", owner: "oslo", billable: true },
  "KVI1001-B": {
    name: "Nettbank - rådgivning",
    client: "Kvist Bank ASA",
    owner: "oslo",
    billable: true,
  },
} satisfies Record<string, ProjectDefinition>;

type ProjectCode = keyof typeof projectCatalog;

type TaskDefinition = { project: ProjectCode; name: string; endsWeek?: number };

const taskCatalog = {
  marketing: { project: "VAR1000", name: "Markedsføring og kommunikasjon" },
  conferences: { project: "VAR1000", name: "Kurs og konferanser" },
  interviews: { project: "VAR1000", name: "Rekruttering - Intervju" },
  variantDay: { project: "VAR1000", name: "Variantdag" },
  onboarding: { project: "VAR1000", name: "Fadder- og oppstartsaktiviteter" },
  workEnvironmentCommittee: { project: "VAR1000", name: "Arbeidsmiljøutvalg" },
  socialCommittee: { project: "VAR1000", name: "Soskom - Planlegging" },
  administration: { project: "VAR1001", name: "Administrasjon og ledelse" },
  betweenProjects: { project: "VAR1099", name: "Mellom prosjekter" },
  betweenProjectsMarketing: { project: "VAR1099", name: "Markedsføring" },
  cleaning: { project: "VAR2000", name: "Renhold" },
  paidWelfareLeave: { project: "VEL1000", name: "Velferdspermisjon med lønn" },
  paternityLeave: {
    project: "VEL1000",
    name: "Fødselspermisjon (14 dager rett etter fødsel, for partner)",
  },
  doctor: { project: "VEL1000", name: "Legetime" },
  parentalLeave: { project: "VEL1001", name: "Foreldrepermisjon" },
  unpaidWelfareLeave: { project: "VEL1001", name: "Velferdspermisjon uten lønn" },
  selfCertifiedSick: { project: "SYK1000", name: "Sykefravær med egenmelding" },
  sickChild: {
    project: "SYK1000",
    name: "Syke barn - hjemme med (10 dager pr år, 15 ved 3+ barn)",
  },
  sickLeave: {
    project: "SYK1000",
    name: "Sykemelding - første 16 dager (arbeidsgiverperioden)",
  },
  vacation: { project: "FER1000", name: "Ferie" },
  portalPrestudy: { project: "LYS1001", name: "Forstudie", endsWeek: -14 },
  portalDevelopment: { project: "LYS1001", name: "Utvikling" },
  portalProjectManagement: { project: "LYS1001", name: "Prosjektledelse" },
  routePlannerDevelopment: { project: "BOL1001", name: "Utvikling" },
  citizenServicesDevelopment: { project: "GRA1001", name: "Utvikling" },
  patientTravelUsability: { project: "FJA1001", name: "Brukskvalitet" },
  bankDevelopment: { project: "KVI1001", name: "Utvikling" },
  bankAdvisory: { project: "KVI1001-B", name: "Rådgivning" },
} satisfies Record<string, TaskDefinition>;

type TaskKey = keyof typeof taskCatalog;
type DayPlan = Partial<Record<TaskKey, number>>;

// Replaces the planned day for the weeks from..to (inclusive), on the given ISO weekdays.
// An empty plan is a day the person forgot to log.
type Exception = { from: number; to?: number; weekdays?: number[]; hours: DayPlan; notes?: string };

type Person = {
  name: string;
  email: string;
  organization: OrganizationSlug;
  manager?: boolean;
  joinedWeek?: number;
  leftWeek?: number;
  weekdays?: number[];
  usualDay: DayPlan;
  // Rates in whole NOK per hour. A rate without fromWeek applies from the start.
  assignments?: { project: ProjectCode; rates: { fromWeek?: number; rate: number }[] }[];
  exceptions?: Exception[];
};

const everyone: Exception[] = [{ from: -7, weekdays: [5], hours: { variantDay: 7.5 } }];

const people: Person[] = [
  {
    name: "Kari Nordmann",
    email: "kari.nordmann@example.com",
    organization: "trondheim",
    usualDay: { portalDevelopment: 7.5 },
    assignments: [{ project: "LYS1001", rates: [{ rate: 1450 }, { fromWeek: -8, rate: 1550 }] }],
    exceptions: [
      { from: firstWeek, to: -14, hours: { portalPrestudy: 7.5 } },
      { from: -10, hours: { vacation: 7.5 } },
      { from: -5, weekdays: [3], hours: { portalDevelopment: 6.5, doctor: 1 } },
      { from: -3, weekdays: [6], hours: { portalDevelopment: 2 }, notes: "Prodsetting" },
    ],
  },
  {
    name: "Ola Hansen",
    email: "ola.hansen@example.com",
    organization: "trondheim",
    usualDay: { routePlannerDevelopment: 4.5, patientTravelUsability: 3 },
    assignments: [
      { project: "BOL1001", rates: [{ rate: 1400 }] },
      { project: "FJA1001", rates: [{ rate: 1350 }] },
    ],
    exceptions: [
      { from: -6, weekdays: [4, 5], hours: { conferences: 7.5 } },
      { from: -1, weekdays: [3], hours: {} },
    ],
  },
  {
    name: "Ingrid Berg",
    email: "ingrid.berg@example.com",
    organization: "trondheim",
    usualDay: { betweenProjects: 6.5, betweenProjectsMarketing: 1 },
    assignments: [{ project: "GRA1001", rates: [{ rate: 1300 }] }],
    exceptions: [{ from: firstWeek, to: -9, hours: { citizenServicesDevelopment: 7.5 } }],
  },
  {
    name: "Jonas Lie",
    email: "jonas.lie@example.com",
    organization: "trondheim",
    usualDay: { portalDevelopment: 7.5 },
    assignments: [{ project: "LYS1001", rates: [{ rate: 1500 }] }],
    exceptions: [
      { from: -12, to: -11, hours: { vacation: 7.5 } },
      { from: -4, weekdays: [2], hours: { sickChild: 7.5 } },
      { from: -2, weekdays: [4, 5], hours: { sickChild: 7.5 } },
    ],
  },
  {
    name: "Sofie Dahl",
    email: "sofie.dahl@example.com",
    organization: "trondheim",
    usualDay: { parentalLeave: 7.5 },
    assignments: [{ project: "BOL1001", rates: [{ rate: 1400 }] }],
    exceptions: [{ from: firstWeek, to: -7, hours: { routePlannerDevelopment: 7.5 } }],
  },
  {
    name: "Mona Strand",
    email: "mona.strand@example.com",
    organization: "trondheim",
    weekdays: [1, 3, 5],
    usualDay: { cleaning: 3 },
  },
  {
    name: "Emil Aas",
    email: "emil.aas@example.com",
    organization: "trondheim",
    joinedWeek: -2,
    usualDay: { betweenProjects: 7.5 },
    exceptions: [{ from: -2, hours: { onboarding: 7.5 } }],
  },
  {
    name: "Thea Moe",
    email: "thea.moe@example.com",
    organization: "trondheim",
    leftWeek: -5,
    usualDay: { patientTravelUsability: 7.5 },
    assignments: [{ project: "FJA1001", rates: [{ rate: 1350 }] }],
  },
  {
    name: "Henrik Vik",
    email: "henrik.vik@example.com",
    organization: "trondheim",
    manager: true,
    usualDay: { administration: 3.75, portalProjectManagement: 3.75 },
    assignments: [{ project: "LYS1001", rates: [{ rate: 1650 }] }],
    exceptions: [
      { from: -4, weekdays: [1, 2], hours: { selfCertifiedSick: 7.5 } },
      { from: -1, weekdays: [2], hours: { administration: 3.75, interviews: 3.75 } },
    ],
  },
  {
    name: "Nora Bakke",
    email: "nora.bakke@example.com",
    organization: "oslo",
    usualDay: { bankDevelopment: 7.5 },
    assignments: [
      { project: "KVI1001", rates: [{ rate: 1600 }] },
      { project: "KVI1001-B", rates: [{ rate: 1850 }] },
    ],
    exceptions: [
      { from: -8, to: -7, hours: { vacation: 7.5 } },
      { from: -3, to: -2, weekdays: [5], hours: { bankAdvisory: 7.5 } },
    ],
  },
  {
    // Works on a Trondheim project, so Oslo participates in it.
    name: "Lars Eide",
    email: "lars.eide@example.com",
    organization: "oslo",
    manager: true,
    usualDay: { portalDevelopment: 7.5 },
    assignments: [{ project: "LYS1001", rates: [{ rate: 1500 }] }],
  },
];

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);
const currentMonday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
const dayOf = (week: number, weekday: number) => addDays(currentMonday, week * 7 + weekday - 1);

function plannedDay(
  person: Person,
  week: number,
  weekday: number,
): Pick<Exception, "hours" | "notes"> | undefined {
  const workdays = person.weekdays ?? [1, 2, 3, 4, 5];
  const applies = (exception: Exception) =>
    week >= exception.from &&
    week <= (exception.to ?? exception.from) &&
    (exception.weekdays ?? workdays).includes(weekday);
  const exception =
    person.exceptions?.find(applies) ??
    everyone.find((exception) => applies(exception) && workdays.includes(weekday));
  if (exception) return exception;
  return workdays.includes(weekday) ? { hours: person.usualDay } : undefined;
}

// Throws when the fixture breaks a rule the app relies on, so a bad edit fails the seed test.
function plannedEntries(person: Person) {
  const entries: { task: TaskKey; spentOn: string; minutes: number; notes?: string }[] = [];
  for (let week = Math.max(firstWeek, person.joinedWeek ?? firstWeek); week <= 0; week++) {
    if (person.leftWeek !== undefined && week > person.leftWeek) break;
    for (let weekday = 1; weekday <= 7; weekday++) {
      const spentOn = dayOf(week, weekday);
      if (spentOn >= today) break;
      const day = plannedDay(person, week, weekday);
      for (const [task, hours] of Object.entries(day?.hours ?? {}) as [TaskKey, number][]) {
        const definition: TaskDefinition = taskCatalog[task];
        const project: ProjectDefinition = projectCatalog[definition.project];
        const isAssigned = person.assignments?.some((a) => a.project === definition.project);
        if (project.billable && !isAssigned) {
          throw new Error(`${person.name} isn't assigned to ${definition.project}`);
        }
        const endsWeek = definition.endsWeek ?? project.endsWeek;
        if (endsWeek !== undefined && week > endsWeek) {
          throw new Error(`${person.name} logs on ${task} after it ended`);
        }
        entries.push({ task, spentOn, minutes: Math.round(hours * 60), notes: day?.notes });
      }
    }
  }
  return entries;
}

function byKey<Row>(rows: Row[], key: (row: Row) => string) {
  return new Map(rows.map((row) => [key(row), row]));
}

function lookup<Value>(map: Map<string, Value>, key: string) {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing ${key}`);
  return value;
}

export function seedDatabase(database: Database) {
  const windowStart = dayOf(firstWeek, 1);
  const projectEntries = Object.entries(projectCatalog) as [ProjectCode, ProjectDefinition][];

  return database.transaction(async (transaction) => {
    const organizationRows = await transaction
      .insert(organizations)
      .values(
        Object.entries(organizationCatalog).map(([slug, name]) => ({
          slug,
          name,
          currency: "NOK",
          fullDayMinutes: 450,
        })),
      )
      .returning();
    const organizationIds = byKey(organizationRows, (row) => row.slug);
    const organizationId = (slug: OrganizationSlug) => lookup(organizationIds, slug).id;

    const userRows = await transaction
      .insert(users)
      .values(
        people.map((person) => ({
          name: person.name,
          email: person.email,
          orgId: organizationId(person.organization),
          createdAt: new Date(dayOf(Math.max(firstWeek, person.joinedWeek ?? firstWeek), 1)),
          endsOn: person.leftWeek === undefined ? null : dayOf(person.leftWeek, 5),
        })),
      )
      .returning();
    const userIds = byKey(userRows, (row) => row.email);
    const userId = (person: Person) => lookup(userIds, person.email).id;

    const managers = people.filter((person) => person.manager);
    await transaction
      .insert(userRoles)
      .values(managers.map((person) => ({ userId: userId(person), role: "manager" as const })));

    const clientNames = [...new Set(projectEntries.map(([, project]) => project.client))];
    const clientRows = await transaction
      .insert(clients)
      .values(clientNames.map((name) => ({ name })))
      .returning();
    const clientIds = byKey(clientRows, (row) => row.name);

    const projectRows = await transaction
      .insert(projects)
      .values(
        projectEntries.map(([code, project]) => ({
          clientId: lookup(clientIds, project.client).id,
          code,
          name: project.name,
          billable: project.billable,
          openToEveryone: !project.billable,
          countsTowardBillableBase: project.countsTowardBillableBase ?? true,
          endsOn: project.endsWeek === undefined ? null : dayOf(project.endsWeek, 5),
        })),
      )
      .returning();
    const projectIds = byKey(projectRows, (row) => row.code);
    const projectId = (code: ProjectCode) => lookup(projectIds, code).id;

    // Internal projects are shared by every organization; customer projects by the owner and
    // the organizations of the people assigned to them.
    const participants = projectEntries.flatMap(([code, project]) => {
      const slugs = project.billable
        ? new Set([
            project.owner,
            ...people
              .filter((person) => person.assignments?.some((a) => a.project === code))
              .map((person) => person.organization),
          ])
        : Object.keys(organizationCatalog);
      return [...slugs].map((slug) => ({
        projectId: projectId(code),
        orgId: organizationId(slug as OrganizationSlug),
        isOwner: slug === project.owner,
      }));
    });
    await transaction.insert(projectOrganizations).values(participants);

    const taskEntries = Object.entries(taskCatalog) as [TaskKey, TaskDefinition][];
    const taskRows = await transaction
      .insert(tasks)
      .values(
        taskEntries.map(([, task]) => ({
          projectId: projectId(task.project),
          name: task.name,
          endsOn: task.endsWeek === undefined ? null : dayOf(task.endsWeek, 5),
        })),
      )
      .returning();
    const taskIdsByName = byKey(taskRows, (row) => `${row.projectId}/${row.name}`);
    const taskId = (key: TaskKey) => {
      const task: TaskDefinition = taskCatalog[key];
      return lookup(taskIdsByName, `${projectId(task.project)}/${task.name}`).id;
    };

    const assignments = people.flatMap((person) =>
      (person.assignments ?? []).map((assignment) => ({ person, ...assignment })),
    );
    await transaction.insert(projectAssignments).values(
      assignments.map(({ person, project }) => ({
        projectId: projectId(project),
        userId: userId(person),
        orgId: organizationId(person.organization),
      })),
    );
    await transaction.insert(assignmentRates).values(
      assignments.flatMap(({ person, project, rates }) =>
        rates.map(({ fromWeek, rate }) => ({
          projectId: projectId(project),
          userId: userId(person),
          validFrom: fromWeek === undefined ? windowStart : dayOf(fromWeek, 1),
          // Minor units.
          rate: rate * 100,
        })),
      ),
    );

    await transaction.insert(timeEntries).values(
      people.flatMap((person) =>
        plannedEntries(person).map(({ task, ...entry }) => ({
          ...entry,
          userId: userId(person),
          taskId: taskId(task),
        })),
      ),
    );
    // Each entry gets the rate a new entry would, like time logged in the app.
    await transaction.execute(
      sql`update time_entries set (rate, currency) = (select rate, currency from entry_rate(user_id, task_id, spent_on))`,
    );
  });
}
