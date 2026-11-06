import { firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { projects, timeEntriesExport } from "@tid/db/schema";
import { and, between } from "drizzle-orm";
import { fixedPriceCondition } from "../projects/fixedPriceFilter";
import { billableCondition } from "../reports/billableFilter";

/**
 * The billable hours in `month` on hourly projects, and on fixed-price ones too when
 * `includeFixedPrice`. The same as the report filtered to billable hours, so the two add up.
 */
export const invoicedHoursIn = (month: string, includeFixedPrice: boolean) =>
  and(
    between(timeEntriesExport.spentDate, firstDayOfMonth(month), lastDayOfMonth(month)),
    billableCondition(true, timeEntriesExport.billable),
    fixedPriceCondition(includeFixedPrice, projects.billing),
  );

export const sumBillableHours = (rows: { billableHours: number }[]) =>
  rows.reduce((sum, row) => sum + row.billableHours, 0);
