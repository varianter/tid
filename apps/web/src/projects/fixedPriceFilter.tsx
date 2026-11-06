import { ne } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { type CheckboxValue, checkboxQuery, FilterCheckbox } from "../framework/filter";
import type { Billing } from "./billing";

const field = "fixedPrice";

/** `?fixedPrice=yes` adds fixed-price projects to the rest. Spread into a page's query. */
export const fixedPriceField = { [field]: checkboxQuery };

const fixedPrice: Billing = "fixed_fee";

/** Leaves out the hours on fixed-price projects unless they're asked for. */
export const fixedPriceCondition = (include: CheckboxValue, billing: PgColumn) =>
  include ? undefined : ne(billing, fixedPrice);

export function FixedPriceCheckbox() {
  return <FilterCheckbox field={field} label="Include fixed price" />;
}
