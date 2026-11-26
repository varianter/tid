import {
  clients,
  organizations,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  timeEntriesExport,
  users,
} from "@tid/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { OrganizationOption } from "../domain/organizations/organizationFilter";
import { database } from "../framework/database";
import { inMonth } from "../framework/monthCondition";
import type { MonthEntry } from "../timeEntries/monthEntries";
import { buildProjectReport, type ProjectReport } from "./projectReport";

/**
 * A project's hours in `month` by the consultants of `consultantsOf`, in the calendar of their
 * country. Undefined for no such project.
 */
export async function loadProjectReport(
  projectId: number,
  month: Temporal.PlainYearMonth,
  consultantsOf: OrganizationOption,
): Promise<ProjectReport | undefined> {
  const project = await loadReportedProject(projectId);
  if (!project) return undefined;
  const consultantAccounts = consultantsOf.organizations.map(
    (organization) => organization.legalName,
  );
  const entries = await loadDayEntries(project.code, month, consultantAccounts);
  return buildProjectReport(project, entries, month, consultantsOf.country);
}

/**
 * A project's hours in `month` by everyone, since its contract owner invoices them all, in the
 * calendar of the contract owner's country. Undefined for no such project, or for one without a
 * contract owner.
 */
export async function loadInvoicedProjectReport(
  projectId: number,
  month: Temporal.PlainYearMonth,
): Promise<ProjectReport | undefined> {
  const project = await loadReportedProject(projectId);
  if (!project?.contractOwnerCountry) return undefined;
  const entries = await loadDayEntries(project.code, month);
  return buildProjectReport(project, entries, month, project.contractOwnerCountry);
}

async function loadReportedProject(projectId: number) {
  const [project] = await database
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      billing: projects.billing,
      currency: projects.currency,
      clientId: clients.id,
      client: clients.name,
      contractOwnerCountry: organizations.country,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(
      projectOrganizations,
      and(
        eq(projectOrganizations.projectId, projects.id),
        eq(projectOrganizations.isContractOwner, true),
      ),
    )
    .leftJoin(organizations, eq(organizations.id, projectOrganizations.orgId))
    .where(eq(projects.id, projectId));
  return project;
}

/** Each consultant's hours a day on the project, by those of `accounts`, or by everyone without it. */
function loadDayEntries(projectCode: string, month: Temporal.PlainYearMonth, accounts?: string[]) {
  const view = timeEntriesExport;
  return database
    .select({
      email: view.userEmail,
      name: view.userName,
      day: view.spentDate,
      hours: sql`sum(${view.hours})`.mapWith(Number),
      amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
    })
    .from(view)
    .where(
      and(
        accounts && inArray(view.accountName, accounts),
        eq(view.projectCode, projectCode),
        inMonth(view.spentDate, month),
      ),
    )
    .groupBy(view.userEmail, view.userName, view.spentDate)
    .orderBy(view.userName);
}

/** The project's entries in `month` by the consultants of `selected`, for a query joining tasks and users. */
const projectEntriesIn = (
  projectId: number,
  month: Temporal.PlainYearMonth,
  selected: OrganizationOption,
) =>
  and(
    eq(tasks.projectId, projectId),
    inArray(
      users.orgId,
      selected.organizations.map((organization) => organization.id),
    ),
    inMonth(timeEntries.spentOn, month),
  );

/** Each entry on the project in `month` by the consultants of `organization`, newest first. */
export const loadProjectEntries = (
  projectId: number,
  month: Temporal.PlainYearMonth,
  selected: OrganizationOption,
): Promise<MonthEntry[]> =>
  database
    .select({
      spentOn: timeEntries.spentOn,
      minutes: timeEntries.minutes,
      notes: timeEntries.notes,
      task: tasks.name,
      title: users.name,
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(projectEntriesIn(projectId, month, selected))
    .orderBy(desc(timeEntries.spentOn), users.name, tasks.name);

/** The minutes one consultant logged on one task. */
export type EntryTotal = {
  consultantId: number;
  consultant: string;
  taskId: number;
  task: string;
  minutes: number;
};

/**
 * The same entries as `loadProjectEntries`, totalled per consultant and task. Sorted by
 * consultant then task, or the other way round, so either groups in order.
 */
export const loadEntryTotals = (
  projectId: number,
  month: Temporal.PlainYearMonth,
  selected: OrganizationOption,
  sortedBy: "consultant" | "task",
): Promise<EntryTotal[]> =>
  database
    .select({
      consultantId: users.id,
      consultant: users.name,
      taskId: tasks.id,
      task: tasks.name,
      minutes: sql`sum(${timeEntries.minutes})`.mapWith(Number),
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(projectEntriesIn(projectId, month, selected))
    // By id, so two people with the same name stay apart.
    .groupBy(users.id, users.name, tasks.id, tasks.name)
    .orderBy(
      ...(sortedBy === "consultant"
        ? [users.name, users.id, tasks.name]
        : [tasks.name, users.name]),
    );
