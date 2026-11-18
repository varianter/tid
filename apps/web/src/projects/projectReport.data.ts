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
import { and, desc, eq, sql } from "drizzle-orm";
import { database } from "../framework/database";
import { inMonth } from "../framework/monthCondition";
import type { MonthEntry } from "../timeEntries/monthEntries";
import { buildProjectReport, type ProjectReport } from "./projectReport";

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

/** Each consultant's hours a day on the project. */
function loadDayEntries(projectCode: string, month: Temporal.PlainYearMonth) {
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
    .where(and(eq(view.projectCode, projectCode), inMonth(view.spentDate, month)))
    .groupBy(view.userEmail, view.userName, view.spentDate)
    .orderBy(view.userName);
}

/** Each entry on the project in `month`, by everyone, newest first. */
export const loadProjectEntries = (
  projectId: number,
  month: Temporal.PlainYearMonth,
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
    .where(and(eq(tasks.projectId, projectId), inMonth(timeEntries.spentOn, month)))
    .orderBy(desc(timeEntries.spentOn), users.name, tasks.name);
