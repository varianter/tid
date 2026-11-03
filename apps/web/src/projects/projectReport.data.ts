import { firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
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
import { and, between, desc, eq, inArray, sql } from "drizzle-orm";
import type { OrganizationOption } from "../domain/organizations/organizationFilter";
import { database } from "../framework/database";
import type { MonthEntry } from "../timeEntries/monthEntries";
import { buildProjectReport, type ProjectReport } from "./projectReport";

/**
 * A project's hours in `month` by the consultants of `consultantsOf`, in the calendar of their
 * country. Undefined for no such project.
 */
export async function loadProjectReport(
  projectId: number,
  month: string,
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
  month: string,
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
function loadDayEntries(projectCode: string, month: string, accounts?: string[]) {
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
        between(view.spentDate, firstDayOfMonth(month), lastDayOfMonth(month)),
      ),
    )
    .groupBy(view.userEmail, view.userName, view.spentDate)
    .orderBy(view.userName);
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
