// Before changing this schema, ask the user whether the app is live.
//
// Not live: keep the migrations squashed. Delete packages/db/migrations, run
//   bunx drizzle-kit generate --name init
//   bunx drizzle-kit generate --custom --name time_entry_rates
//   bunx drizzle-kit generate --custom --name time_entries_export
//   bunx drizzle-kit generate --custom --name organizations
//   bunx drizzle-kit generate --custom --name month_locks
// then copy time_entry_rates.sql, time_entries_export.sql, organizations.sql and month_locks.sql
// over the generated, empty files. Databases that ran the old migrations have to be rebuilt afterwards:
// locally with bun run db:reset or bun run harvest:import:norway, and deployed ones by emptying them.
//
// Live: never edit or delete a migration, since the live database has already run it.
// Add new ones with drizzle-kit generate. Delete this comment, time_entry_rates.sql,
// time_entries_export.sql, organizations.sql and month_locks.sql.

// Where a rule lives is a choice, not a default. Enforce an invariant in the
// database when every writer must obey it or a violation corrupts data — a
// uniqueness, a range, referential integrity, "at most one active lock". Those
// hold for the app, the Harvest import, and any future writer, so no one code
// path can be trusted to keep them. Keep policy and feedback in the app: rules
// that change often, or that need a message the user can act on. When the two
// overlap, keep the invariant in the database and the message in the app.

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
    // ISO 3166-1 alpha-2, like NO or SE.
    country: char({ length: 2 }).notNull(),
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
  (table) => [
    unique().on(table.provider, table.tenantId, table.subject),
    unique().on(table.userId, table.provider, table.tenantId),
  ],
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
// The rate is locked when the entry is created, so a rate that's later added for the future
// doesn't reprice logged time. See time_entry_rates.sql for how it's picked. A backdated rate
// does reprice its period; the app does that when it adds the rate.
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

// A locked month stops an organization's time entries in it from changing, so invoiced hours stay
// put. Their rates can still be corrected. Unlocking keeps the row as history; month_locks.sql
// enforces the lock.
export const monthLocks = pgTable(
  "month_locks",
  {
    id: id(),
    orgId: reference().references(() => organizations.id),
    month: date().notNull(),
    lockedBy: reference(),
    lockedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    unlockedBy: bigint({ mode: "number" }),
    unlockedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    // Only the organization's own people may lock or unlock its months.
    foreignKey({
      name: "month_locks_locked_by_in_organization",
      columns: [table.lockedBy, table.orgId],
      foreignColumns: [users.id, users.orgId],
    }),
    foreignKey({
      name: "month_locks_unlocked_by_in_organization",
      columns: [table.unlockedBy, table.orgId],
      foreignColumns: [users.id, users.orgId],
    }),
    uniqueIndex("month_locks_one_active")
      .on(table.orgId, table.month)
      .where(sql`${table.unlockedAt} is null`),
    check("month_is_first_day", sql`extract(day from ${table.month}) = 1`),
    check("unlocked_by_and_at", sql`(${table.unlockedBy} is null) = (${table.unlockedAt} is null)`),
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
