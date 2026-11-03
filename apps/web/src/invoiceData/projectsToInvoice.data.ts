import { firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import {
  organizations,
  projectOrganizations,
  projects,
  timeEntriesExport,
  users,
} from "@tid/db/schema";
import { and, between, eq, inArray, sql } from "drizzle-orm";
import { database } from "../framework/database";
import type { Billing } from "../projects/billing";

export type ProjectToInvoice = {
  id: number;
  code: string;
  name: string;
  client: string;
  billing: Billing;
  contractOwner: string;
  invoicingLead: string | null;
  billableHours: number;
  amount: number;
  currency: string | null;
};

/**
 * The projects with hours in `month`, whichever organization owns the contract: hourly ones, and
 * fixed-price ones too when `includeFixedPrice`. Every hour on them is billable, whoever logged it.
 * By client, then project.
 */
export function loadProjectsToInvoice(
  month: string,
  includeFixedPrice: boolean,
): Promise<ProjectToInvoice[]> {
  const view = timeEntriesExport;
  const billings: Billing[] = includeFixedPrice ? ["hourly", "fixed_fee"] : ["hourly"];
  return database
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      client: view.clientName,
      billing: projects.billing,
      contractOwner: organizations.name,
      invoicingLead: users.name,
      billableHours: sql`sum(${view.billableHours})`.mapWith(Number),
      amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
      currency: projects.currency,
    })
    .from(view)
    .innerJoin(projects, eq(projects.code, view.projectCode))
    .innerJoin(
      projectOrganizations,
      and(
        eq(projectOrganizations.projectId, projects.id),
        eq(projectOrganizations.isContractOwner, true),
      ),
    )
    .innerJoin(organizations, eq(organizations.id, projectOrganizations.orgId))
    .leftJoin(users, eq(users.id, projects.invoicingLeadId))
    .where(
      and(
        between(view.spentDate, firstDayOfMonth(month), lastDayOfMonth(month)),
        inArray(projects.billing, billings),
      ),
    )
    .groupBy(projects.id, view.clientName, organizations.name, users.name)
    .orderBy(view.clientName, projects.name);
}
