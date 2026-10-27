import { firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { clients, projects, tasks, timeEntries, timeEntriesExport, users } from "@tid/db/schema";
import { and, between, desc, eq, inArray, sql } from "drizzle-orm";
import { database } from "../database";
import type { OrganizationOption } from "../organizations/organizationFilter";
import type { MonthEntry } from "../timeEntries/monthEntries";
import { buildProjectReport, type ProjectReport } from "./projectReport";

/** A project's hours in `month` by the consultants of `organization`, or undefined for no such project. */
export async function loadProjectReport(
  projectId: number,
  month: string,
  selected: OrganizationOption,
): Promise<ProjectReport | undefined> {
  const [project] = await database
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      billing: projects.billing,
      currency: projects.currency,
      clientId: clients.id,
      client: clients.name,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.id, projectId));
  if (!project) return undefined;

  const view = timeEntriesExport;
  const entries = await database
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
        // Each organization invoices the work of its own consultants.
        inArray(
          view.accountName,
          selected.organizations.map((organization) => organization.legalName),
        ),
        eq(view.projectCode, project.code),
        between(view.spentDate, firstDayOfMonth(month), lastDayOfMonth(month)),
      ),
    )
    .groupBy(view.userEmail, view.userName, view.spentDate)
    .orderBy(view.userName);

  return buildProjectReport(project, entries, month, selected);
}

/** Each entry on the project in `month` by the consultants of `organization`, newest first. */
export const loadProjectEntries = (
  projectId: number,
  month: string,
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
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(
          users.orgId,
          selected.organizations.map((organization) => organization.id),
        ),
        between(timeEntries.spentOn, firstDayOfMonth(month), lastDayOfMonth(month)),
      ),
    )
    .orderBy(desc(timeEntries.spentOn), users.name, tasks.name);
