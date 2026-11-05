import { organizations, projects, timeEntriesExport } from "@tid/db/schema";
import { eq, sql } from "drizzle-orm";
import { database } from "../framework/database";
import { invoicedHoursIn } from "../invoiceData/invoicedHours";

export type BilledProject = {
  organizationId: number;
  id: number;
  billableHours: number;
  amount: number;
  currency: string | null;
};

/**
 * The projects to invoice in `month`, once for each organization whose consultants logged hours on
 * them, with only those hours. Internal invoicing aside, this is what each organization earned.
 */
export function loadBilledProjects(
  month: string,
  includeFixedPrice: boolean,
): Promise<BilledProject[]> {
  const view = timeEntriesExport;
  return (
    database
      .select({
        organizationId: organizations.id,
        id: projects.id,
        billableHours: sql`sum(${view.billableHours})`.mapWith(Number),
        amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
        currency: projects.currency,
      })
      .from(view)
      .innerJoin(projects, eq(projects.code, view.projectCode))
      // The view names the consultant's organization by its legal name.
      .innerJoin(organizations, eq(organizations.legalName, view.accountName))
      .where(invoicedHoursIn(month, includeFixedPrice))
      .groupBy(organizations.id, projects.id)
  );
}
