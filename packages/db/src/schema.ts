// Before changing this schema, ask the user whether the app is live.
//
// Not live: keep the migrations squashed. Delete packages/db/migrations, run
//   bunx drizzle-kit generate --name init
//   bunx drizzle-kit generate --custom --name time_entry_rates
//   bunx drizzle-kit generate --custom --name time_entries_export
// then copy time_entry_rates.sql and time_entries_export.sql over the generated, empty files.
// Local databases have to be rebuilt afterwards: bun run db:reset, or bun run db:import.
//
// Live: never edit or delete a migration, since the live database has already run it.
// Add new ones with drizzle-kit generate. Delete this comment, time_entry_rates.sql and
// time_entries_export.sql.

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity();
const reference = () => bigint({ mode: "number" }).notNull();

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    currency: char({ length: 3 }).notNull(),
    fullDayMinutes: integer().notNull(),
  },
  (table) => [check("full_day_minutes_range", sql`${table.fullDayMinutes} between 1 and 1440`)],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text().notNull(),
    email: text().notNull(),
    orgId: reference().references(() => organizations.id),
    endsOn: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The reporting database identifies people by email, so it must be unique regardless of case.
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
    index("users_org_id").on(table.orgId),
    // Lets assignments check that the user belongs to the organization they're assigned through.
    unique().on(table.id, table.orgId),
  ],
);

export const userRole = pgEnum("user_role", ["manager"]);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: reference().references(() => users.id),
    role: userRole().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const userIdentities = pgTable(
  "user_identities",
  {
    id: id(),
    userId: reference().references(() => users.id),
    provider: text().notNull(),
    tenantId: text().notNull(),
    subject: text().notNull(),
  },
  (table) => [unique().on(table.provider, table.tenantId, table.subject)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text().notNull().unique(),
    userId: reference().references(() => users.id),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id").on(table.userId)],
);

// Clients and projects are shared across organizations. A client found in several
// Harvest accounts becomes one row; downstream reporting matches on project code.
export const clients = pgTable("clients", {
  id: id(),
  name: text().notNull().unique(),
});

export const projects = pgTable(
  "projects",
  {
    id: id(),
    clientId: reference().references(() => clients.id),
    // Used outside the app, and the reporting database holds at most 16 characters.
    code: text().notNull().unique(),
    name: text().notNull(),
    billable: boolean().notNull(),
    openToEveryone: boolean().notNull().default(false),
    // Only used by reporting, to leave out time such as vacation from billable base hours.
    countsTowardBillableBase: boolean().notNull().default(true),
    startsOn: date(),
    endsOn: date(),
  },
  (table) => [
    unique().on(table.clientId, table.name),
    check("code_length", sql`length(${table.code}) <= 16`),
    check("open_projects_not_billable", sql`not (${table.openToEveryone} and ${table.billable})`),
    check(
      "billable_projects_count_toward_base",
      sql`not ${table.billable} or ${table.countsTowardBillableBase}`,
    ),
    check("ends_after_start", sql`${table.endsOn} >= ${table.startsOn}`),
  ],
);

export const projectOrganizations = pgTable(
  "project_organizations",
  {
    projectId: reference().references(() => projects.id),
    orgId: reference().references(() => organizations.id),
    isOwner: boolean().notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.orgId] }),
    uniqueIndex("project_organizations_one_owner").on(table.projectId).where(sql`${table.isOwner}`),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    projectId: reference().references(() => projects.id),
    name: text().notNull(),
    endsOn: date(),
  },
  (table) => [unique().on(table.projectId, table.name)],
);

// Only users from a participating organization may be assigned to the project: org_id must
// be both the user's organization and one of the project's.
export const projectAssignments = pgTable(
  "project_assignments",
  {
    projectId: reference(),
    userId: reference(),
    orgId: reference(),
    startsOn: date(),
    endsOn: date(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    foreignKey({
      name: "project_assignments_user_in_organization",
      columns: [table.userId, table.orgId],
      foreignColumns: [users.id, users.orgId],
    }),
    foreignKey({
      name: "project_assignments_organization_on_project",
      columns: [table.projectId, table.orgId],
      foreignColumns: [projectOrganizations.projectId, projectOrganizations.orgId],
    }),
    index("project_assignments_user_id").on(table.userId),
    check("ends_after_start", sql`${table.endsOn} >= ${table.startsOn}`),
  ],
);

// The rate for an entry is the latest one with valid_from <= spent_on.
export const assignmentRates = pgTable(
  "assignment_rates",
  {
    projectId: reference(),
    userId: reference(),
    validFrom: date().notNull(),
    // Minor units of the organization's currency.
    rate: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId, table.validFrom] }),
    foreignKey({
      columns: [table.projectId, table.userId],
      foreignColumns: [projectAssignments.projectId, projectAssignments.userId],
    }),
    check("rate_not_negative", sql`${table.rate} >= 0`),
  ],
);

// One row per user, task and day, with one note for the day.
// Users must be assigned to the project unless it's open to everyone. The app enforces
// this rather than the database, so it can tell the user why an entry was rejected.
// The rate is locked when the entry is created, so later changes to assignment_rates don't
// reprice logged time. See time_entry_rates.sql for how it's picked.
export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    userId: reference().references(() => users.id),
    taskId: reference().references(() => tasks.id),
    spentOn: date().notNull(),
    minutes: integer().notNull(),
    notes: text(),
    // Minor units of the currency.
    rate: integer(),
    currency: char({ length: 3 }),
  },
  (table) => [
    unique().on(table.userId, table.taskId, table.spentOn),
    index("time_entries_task_id").on(table.taskId),
    check("minutes_range", sql`${table.minutes} between 0 and 1440`),
    check("rate_not_negative", sql`${table.rate} >= 0`),
    check("rate_has_currency", sql`(${table.rate} is null) = (${table.currency} is null)`),
  ],
);

// Defined in time_entries_export.sql; drizzle-kit can't manage views with lateral joins.
export const timeEntriesExport = pgView("time_entries_export", {
  accountName: text().notNull(),
  spentDate: date().notNull(),
  spentYear: integer().notNull(),
  spentMonth: integer().notNull(),
  userEmail: text().notNull(),
  userName: text().notNull(),
  clientName: text().notNull(),
  projectCode: text().notNull(),
  projectName: text().notNull(),
  taskName: text().notNull(),
  billable: boolean().notNull(),
  hours: numeric().notNull(),
  billableHours: numeric().notNull(),
  billableBaseHours: numeric().notNull(),
  billableRate: numeric({ precision: 18, scale: 2 }),
  amount: numeric(),
  spentYearWeek: integer().notNull(),
}).existing();
