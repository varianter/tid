import { type Calendar, calendarFor } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import { daysOfMonth, firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { clients, projects, tasks, timeEntries, timeEntriesExport, users } from "@tid/db/schema";
import { and, between, desc, eq, inArray, sql } from "drizzle-orm";
import { formatAmount } from "../amount/amount";
import { database } from "../database";
import type { Company } from "../organizations/companyFilter";
import type { MonthEntry } from "../timeEntries/monthEntries";
import type { Billing } from "./billing";

type Consultant = { name: string; hoursByDay: Map<string, number>; hours: number };

export type ProjectReport = {
  project: {
    id: number;
    code: string;
    name: string;
    billing: Billing;
    clientId: number;
    client: string;
  };
  /** The month, as people read it. */
  period: string;
  days: string[];
  calendar: Calendar;
  consultants: Consultant[];
  hours: number;
  /** Only hourly projects have an amount to show. */
  amount: string | undefined;
};

/** A project's hours in `month` by the consultants of `company`, or undefined for no such project. */
export async function loadProjectReport(
  projectId: number,
  month: string,
  company: Company,
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
          company.organizations.map((organization) => organization.legalName),
        ),
        eq(view.projectCode, project.code),
        between(view.spentDate, firstDayOfMonth(month), lastDayOfMonth(month)),
      ),
    )
    .groupBy(view.userEmail, view.userName, view.spentDate)
    .orderBy(view.userName);

  const consultants = new Map<string, Consultant>();
  for (const entry of entries) {
    const consultant = consultants.get(entry.email) ?? {
      name: entry.name,
      hoursByDay: new Map(),
      hours: 0,
    };
    consultant.hoursByDay.set(entry.day, entry.hours);
    consultant.hours += entry.hours;
    consultants.set(entry.email, consultant);
  }

  return {
    project,
    period: formatDate(month, "month"),
    days: daysOfMonth(month),
    calendar: calendarFor(company.country),
    consultants: [...consultants.values()],
    hours: entries.reduce((total, entry) => total + entry.hours, 0),
    amount:
      project.billing === "hourly" && project.currency
        ? formatAmount(
            entries.reduce((total, entry) => total + entry.amount, 0),
            project.currency,
            2,
          )
        : undefined,
  };
}

/** Each entry on the project in `month` by the consultants of `company`, newest first. */
export const loadProjectEntries = (
  projectId: number,
  month: string,
  company: Company,
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
          company.organizations.map((organization) => organization.id),
        ),
        between(timeEntries.spentOn, firstDayOfMonth(month), lastDayOfMonth(month)),
      ),
    )
    .orderBy(desc(timeEntries.spentOn), users.name, tasks.name);
