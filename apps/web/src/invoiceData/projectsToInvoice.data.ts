import {
  organizations,
  projectOrganizations,
  projects,
  timeEntriesExport,
  users,
} from "@tid/db/schema";
import { and, eq, type SQL, sql } from "drizzle-orm";
import { database } from "../framework/database";
import type { Billing } from "../projects/billing";
import { invoicedHoursIn } from "./invoicedHours";

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
 * By contract owner, then client, then project.
 */
export function loadProjectsToInvoice(
  month: string,
  includeFixedPrice: boolean,
): Promise<ProjectToInvoice[]> {
  return selectProjectsToInvoice(invoicedHoursIn(month, includeFixedPrice));
}

/**
 * Whether `month`'s invoice data holds the project, with fixed-price projects included: undefined
 * when it doesn't, so its files aren't made for a month it isn't invoiced in.
 */
export async function loadProjectToInvoice(
  projectId: number,
  month: string,
): Promise<ProjectToInvoice | undefined> {
  const [project] = await selectProjectsToInvoice(
    and(eq(projects.id, projectId), invoicedHoursIn(month, true)),
  );
  return project;
}

function selectProjectsToInvoice(where: SQL | undefined): Promise<ProjectToInvoice[]> {
  const view = timeEntriesExport;
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
    .where(where)
    .groupBy(projects.id, view.clientName, organizations.name, users.name)
    .orderBy(organizations.name, view.clientName, projects.name);
}
