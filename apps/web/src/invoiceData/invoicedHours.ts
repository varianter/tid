import { projects, timeEntriesExport } from "@tid/db/schema";
import { and } from "drizzle-orm";
import { inMonth } from "../framework/monthCondition";
import { fixedPriceCondition } from "../projects/fixedPriceFilter";
import { billableCondition } from "../reports/billableFilter";

/**
 * The billable hours in `month` on hourly projects, and on fixed-price ones too when
 * `includeFixedPrice`. The same as the report filtered to billable hours, so the two add up.
 */
export const invoicedHoursIn = (month: Temporal.PlainYearMonth, includeFixedPrice: boolean) =>
  and(
    inMonth(timeEntriesExport.spentDate, month),
    billableCondition(true, timeEntriesExport.billable),
    fixedPriceCondition(includeFixedPrice, projects.billing),
  );

export const sumBillableHours = (rows: { billableHours: number }[]) =>
  rows.reduce((sum, row) => sum + row.billableHours, 0);
