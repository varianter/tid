import { projects, timeEntriesExport } from "@tid/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { database } from "../framework/database";
import { inMonth } from "../framework/monthCondition";
import type { InvoiceDataEntry } from "./invoiceDataCsv";

/**
 * A project's code, and each of its entries in `month` by everyone, newest first. Undefined for no
 * such project.
 */
export async function loadInvoiceDataCsv(
  projectId: number,
  month: Temporal.PlainYearMonth,
): Promise<{ projectCode: string; entries: InvoiceDataEntry[] } | undefined> {
  const [project] = await database
    .select({ code: projects.code })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return undefined;

  const view = timeEntriesExport;
  const entries = await database
    .select({
      projectCode: view.projectCode,
      projectName: view.projectName,
      spentOn: view.spentDate,
      user: view.userName,
      task: view.taskName,
      // The view rounds hours to two decimals, which minutes undo exactly.
      minutes: sql`round(${view.hours} * 60)`.mapWith(Number),
      amount: sql`coalesce(${view.amount}, 0)`.mapWith(Number),
    })
    .from(view)
    .where(and(eq(view.projectCode, project.code), inMonth(view.spentDate, month)))
    .orderBy(desc(view.spentDate), view.userName, view.taskName);
  return { projectCode: project.code, entries };
}
