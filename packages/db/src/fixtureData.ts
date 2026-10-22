import type { Country } from "@tid/calendar/publicHolidays";
import type { billing } from "./schema";
import { Weekday } from "./week";

// Fictional people on fictional customers, shaped after a month of real Harvest data: mostly
// 7.5-hour days on one customer, internal time for leave and between projects, few notes.
// Weeks are relative to the current one (0), so the data stays recent whenever it's seeded.

// The recent weeks are realistic: leaves, people joining and leaving, a prestudy that wraps up.
// When seeding asks for more history, the weeks before this repeat each person's usual day, so
// a performance run gets a large, mostly unchanging tail.
export const recentStartWeek = -17;

// Organizations come from the migrations; people and projects refer to them by slug.
export type OrganizationSlug = "trondheim" | "oslo" | "stockholm" | "goteborg";

// Mirrors the migrations, so the fixture can check its rules without a database.
export const organizationCountries: Record<OrganizationSlug, Country> = {
  trondheim: "NO",
  oslo: "NO",
  stockholm: "SE",
  goteborg: "SE",
};

export type ProjectDefinition = {
  name: string;
  client: string;
  owner: OrganizationSlug;
  billing: (typeof billing.enumValues)[number];
  countsTowardBillableBase?: boolean;
  endsWeek?: number;
  // Internal projects are open to every organization in these countries. Defaults to the owner's.
  openTo?: Country[];
};

export function openCountries(project: ProjectDefinition) {
  return project.openTo ?? [organizationCountries[project.owner]];
}

const internal = { client: "Varianttid", owner: "trondheim", billing: "non_billable" } as const;

// Varianttid's internal projects are copied from Harvest, except the ones open in every country,
// which are named in English since no country owns them. Customer projects are made up, with
// codes shaped like the real ones; a suffix splits a project that bills at a different rate.
export const projectCatalog = {
  VAR1000: { ...internal, name: "Variantdrift" },
  VAR1001: { ...internal, name: "Variantdrift - Admin" },
  VAR1099: { ...internal, name: "Variantdrift - mellom prosjekter" },
  VAR2000: { ...internal, name: "Renhold" },
  VEL1000: { ...internal, name: "Velferdspermisjoner med lønn", countsTowardBillableBase: false },
  VEL1001: { ...internal, name: "Velferdspermisjoner fra NAV samt permisjon uten lønn" },
  SYK1000: { ...internal, name: "Sick leave", openTo: ["NO", "SE"] },
  FER1000: {
    ...internal,
    name: "Vacation",
    countsTowardBillableBase: false,
    openTo: ["NO", "SE"],
  },
  INT1000: { ...internal, owner: "stockholm", name: "Interntid" },
  LYS1001: {
    name: "Kundeportal",
    client: "Lysning Energi AS",
    owner: "trondheim",
    billing: "hourly",
  },
  BOL1001: {
    name: "Ruteplanlegger",
    client: "Bølge Transport AS",
    owner: "trondheim",
    billing: "hourly",
  },
  GRA1001: {
    name: "Innbyggertjenester",
    client: "Granlia kommune",
    owner: "trondheim",
    billing: "fixed_fee",
    endsWeek: -9,
  },
  FJA1001: {
    name: "Pasientreise",
    client: "Fjære Helse AS",
    owner: "trondheim",
    billing: "hourly",
  },
  KVI1001: { name: "Nettbank", client: "Kvist Bank ASA", owner: "oslo", billing: "hourly" },
  "KVI1001-B": {
    name: "Nettbank - rådgivning",
    client: "Kvist Bank ASA",
    owner: "oslo",
    billing: "hourly",
  },
  EKD1001: {
    name: "Skadeanmälan",
    client: "Ekdal Försäkring AB",
    owner: "stockholm",
    billing: "hourly",
  },
} satisfies Record<string, ProjectDefinition>;

export type ProjectCode = keyof typeof projectCatalog;

export type TaskDefinition = { project: ProjectCode; name: string; endsWeek?: number };

export const taskCatalog = {
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
  selfCertifiedSick: { project: "SYK1000", name: "Self-certified" },
  sickChild: { project: "SYK1000", name: "Sick child" },
  sickLeave: { project: "SYK1000", name: "Doctor's note" },
  vacation: { project: "FER1000", name: "Vacation" },
  competenceDevelopment: { project: "INT1000", name: "Kompetensutveckling" },
  betweenAssignments: { project: "INT1000", name: "Mellan uppdrag" },
  portalPrestudy: { project: "LYS1001", name: "Forstudie", endsWeek: -14 },
  portalDevelopment: { project: "LYS1001", name: "Utvikling" },
  portalProjectManagement: { project: "LYS1001", name: "Prosjektledelse" },
  routePlannerDevelopment: { project: "BOL1001", name: "Utvikling" },
  citizenServicesDevelopment: { project: "GRA1001", name: "Utvikling" },
  patientTravelUsability: { project: "FJA1001", name: "Brukskvalitet" },
  bankDevelopment: { project: "KVI1001", name: "Utvikling" },
  bankAdvisory: { project: "KVI1001-B", name: "Rådgivning" },
  claimsDevelopment: { project: "EKD1001", name: "Utveckling" },
} satisfies Record<string, TaskDefinition>;

export type TaskKey = keyof typeof taskCatalog;
export type DayPlan = Partial<Record<TaskKey, number>>;

// Replaces the planned day for the weeks from..to (inclusive), on the given ISO weekdays.
// An empty plan is a day the person forgot to log.
export type Exception = {
  from: number;
  to?: number;
  weekdays?: Weekday[];
  hours: DayPlan;
  notes?: string;
};

export type Person = {
  name: string;
  email: string;
  organization: OrganizationSlug;
  manager?: boolean;
  joinedWeek?: number;
  leftWeek?: number;
  weekdays?: Weekday[];
  usualDay: DayPlan;
  // Rates per hour in whole units of the project's currency. A rate without fromWeek applies from
  // the start.
  assignments?: { project: ProjectCode; rates: { fromWeek?: number; rate: number }[] }[];
  exceptions?: Exception[];
};

// Applies to everyone in the country, alongside their own exceptions. A Variantdag in Norway.
export const companyWideExceptions: Record<Country, Exception[]> = {
  NO: [{ from: -7, weekdays: [Weekday.Friday], hours: { variantDay: 7.5 } }],
  SE: [],
};

export const people: Person[] = [
  {
    name: "Kari Nordmann",
    email: "kari.nordmann@example.com",
    organization: "trondheim",
    usualDay: { portalDevelopment: 7.5 },
    assignments: [{ project: "LYS1001", rates: [{ rate: 1450 }, { fromWeek: -8, rate: 1550 }] }],
    exceptions: [
      { from: recentStartWeek, to: -14, hours: { portalPrestudy: 7.5 } },
      { from: -10, hours: { vacation: 7.5 } },
      { from: -5, weekdays: [Weekday.Wednesday], hours: { portalDevelopment: 6.5, doctor: 1 } },
      {
        from: -3,
        weekdays: [Weekday.Saturday],
        hours: { portalDevelopment: 2 },
        notes: "Prodsetting",
      },
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
      { from: -6, weekdays: [Weekday.Thursday, Weekday.Friday], hours: { conferences: 7.5 } },
      { from: -1, weekdays: [Weekday.Wednesday], hours: {} },
    ],
  },
  {
    name: "Ingrid Berg",
    email: "ingrid.berg@example.com",
    organization: "trondheim",
    usualDay: { betweenProjects: 6.5, betweenProjectsMarketing: 1 },
    assignments: [{ project: "GRA1001", rates: [] }],
    exceptions: [{ from: recentStartWeek, to: -9, hours: { citizenServicesDevelopment: 7.5 } }],
  },
  {
    name: "Jonas Lie",
    email: "jonas.lie@example.com",
    organization: "trondheim",
    usualDay: { portalDevelopment: 7.5 },
    assignments: [{ project: "LYS1001", rates: [{ rate: 1500 }] }],
    exceptions: [
      { from: -12, to: -11, hours: { vacation: 7.5 } },
      { from: -4, weekdays: [Weekday.Tuesday], hours: { sickChild: 7.5 } },
      { from: -2, weekdays: [Weekday.Thursday, Weekday.Friday], hours: { sickChild: 7.5 } },
    ],
  },
  {
    name: "Sofie Dahl",
    email: "sofie.dahl@example.com",
    organization: "trondheim",
    usualDay: { parentalLeave: 7.5 },
    assignments: [{ project: "BOL1001", rates: [{ rate: 1400 }] }],
    exceptions: [{ from: recentStartWeek, to: -7, hours: { routePlannerDevelopment: 7.5 } }],
  },
  {
    name: "Mona Strand",
    email: "mona.strand@example.com",
    organization: "trondheim",
    weekdays: [Weekday.Monday, Weekday.Wednesday, Weekday.Friday],
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
    usualDay: { administration: 4, portalProjectManagement: 3.5 },
    // The future rate can still be deleted.
    assignments: [{ project: "LYS1001", rates: [{ rate: 1650 }, { fromWeek: 2, rate: 1700 }] }],
    exceptions: [
      { from: -4, weekdays: [Weekday.Monday, Weekday.Tuesday], hours: { selfCertifiedSick: 7.5 } },
      { from: -1, weekdays: [Weekday.Tuesday], hours: { administration: 4, interviews: 3.5 } },
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
      { from: -3, to: -2, weekdays: [Weekday.Friday], hours: { bankAdvisory: 7.5 } },
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
  {
    name: "Astrid Lindqvist",
    email: "astrid.lindqvist@example.com",
    organization: "stockholm",
    manager: true,
    usualDay: { claimsDevelopment: 8 },
    assignments: [{ project: "EKD1001", rates: [{ rate: 1250 }] }],
    exceptions: [
      { from: -9, hours: { vacation: 8 } },
      { from: -3, weekdays: [Weekday.Thursday], hours: { sickChild: 8 } },
    ],
  },
  {
    // Works on a Stockholm project, so Göteborg participates in it.
    name: "Erik Sjöberg",
    email: "erik.sjoberg@example.com",
    organization: "goteborg",
    usualDay: { claimsDevelopment: 8 },
    assignments: [{ project: "EKD1001", rates: [{ rate: 1150 }] }],
    exceptions: [
      { from: recentStartWeek, to: -12, hours: { betweenAssignments: 8 } },
      { from: -6, weekdays: [Weekday.Friday], hours: { competenceDevelopment: 8 } },
      { from: -2, weekdays: [Weekday.Monday], hours: { selfCertifiedSick: 8 } },
    ],
  },
  {
    // Works on an Oslo project, so Stockholm participates in it and her hours are billed in NOK.
    name: "Maja Holm",
    email: "maja.holm@example.com",
    organization: "stockholm",
    usualDay: { bankDevelopment: 8 },
    assignments: [{ project: "KVI1001", rates: [{ rate: 1550 }] }],
  },
];

// Each person is assigned to one billable project and logs a full day on it, so their hours are
// priced like the hand-written people's.
type SyntheticTemplate = Pick<Person, "organization" | "usualDay"> & {
  project: ProjectCode;
  rate: number;
};

const syntheticTemplates: SyntheticTemplate[] = [
  {
    organization: "trondheim",
    usualDay: { portalDevelopment: 7.5 },
    project: "LYS1001",
    rate: 1450,
  },
  {
    organization: "trondheim",
    usualDay: { routePlannerDevelopment: 7.5 },
    project: "BOL1001",
    rate: 1400,
  },
  {
    organization: "trondheim",
    usualDay: { patientTravelUsability: 7.5 },
    project: "FJA1001",
    rate: 1350,
  },
  { organization: "oslo", usualDay: { bankDevelopment: 7.5 }, project: "KVI1001", rate: 1600 },
  { organization: "stockholm", usualDay: { claimsDevelopment: 8 }, project: "EKD1001", rate: 1250 },
];

// Fills the fixture out for performance testing, taking turns on the templates.
export function syntheticPeople(count: number): Person[] {
  return Array.from({ length: count }, (_, index) => {
    // The remainder always indexes into the list.
    const { organization, usualDay, project, rate } = syntheticTemplates[
      index % syntheticTemplates.length
    ] as SyntheticTemplate;
    return {
      name: `Performance Consultant ${index + 1}`,
      email: `performance.${index + 1}@example.com`,
      organization,
      usualDay,
      assignments: [{ project, rates: [{ rate }] }],
    };
  });
}
