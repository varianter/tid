import { Label, Select } from "@tid/ui";
import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { FilterForm, usePageSearch } from "../query/queryPage";

const field = "billable";
const yes = "yes";
const no = "no";

const billableQuery = z
  .stringbool({ truthy: [yes], falsy: [no] })
  .optional()
  .catch(undefined);

/** `?billable=yes` or `no` narrows a page to billable or non-billable hours; without it, all. Spread into a page's query. */
export const billableField = { [field]: billableQuery };

export const billableCondition = (filter: z.output<typeof billableQuery>, billable: PgColumn) =>
  filter === undefined ? undefined : eq(billable, filter);

export function BillableSelect() {
  const selected = usePageSearch().get(field) ?? "";
  const options = [
    { value: "", label: "All" },
    { value: yes, label: "Billable" },
    { value: no, label: "Non-billable" },
  ];
  return (
    <FilterForm field={field}>
      <Label for={field}>Hours</Label>
      <Select id={field} name={field} data-size="small" selected={selected} options={options} />
    </FilterForm>
  );
}
