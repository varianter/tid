import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { type CheckboxValue, checkboxQuery, FilterCheckbox } from "../framework/filter";

const field = "billable";

/** `?billable=yes` narrows a page to billable hours; without it, all. Spread into a page's query. */
export const billableField = { [field]: checkboxQuery };

export const billableCondition = (onlyBillable: CheckboxValue, billable: PgColumn) =>
  onlyBillable ? eq(billable, true) : undefined;

export function BillableCheckbox() {
  return <FilterCheckbox field={field} label="Show only billable" />;
}
