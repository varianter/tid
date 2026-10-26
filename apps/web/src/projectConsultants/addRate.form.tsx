import { formatDate } from "@tid/calendar/dateDisplay";
import { isIsoDate } from "@tid/calendar/isoDate";
import { Badge, Button, DataGrid, EmptyState, FormField, Page } from "@tid/ui";
import { z } from "zod";
import { formatAmount } from "../amount/amount";
import type { FormProps } from "../form/formAction";
import type { Consultant } from "./assignment";
import { DeleteRateForm } from "./deleteRate.form";
import { ratePeriods } from "./ratePeriods";

export const addRateForm = z.object({
  rate: z
    .string()
    .trim()
    .min(1, "Enter a rate")
    .transform(Number)
    .pipe(z.number("Enter a number").min(0, "Can't be negative"))
    // Stored in minor units.
    .transform((rate) => Math.round(rate * 100)),
  validFrom: z.string().refine(isIsoDate, "Choose a date"),
});

type RatesPageProps = {
  consultant: Consultant;
  rates: { validFrom: string; rate: number }[];
  today: string;
} & FormProps;

export function RatesPage({ consultant, rates, today, values, fieldErrors }: RatesPageProps) {
  return (
    <Page
      title={`Billable rates for ${consultant.name}`}
      back={{
        href: `/projects/${consultant.projectId}`,
        label: `Back to ${consultant.projectName}`,
      }}
    >
      <form method="post" class="stack-h items-end gap-xs wrap">
        <FormField
          name="rate"
          label={`Hourly rate (${consultant.currency})`}
          type="number"
          min="0"
          step="0.01"
          value={values?.rate}
          errors={fieldErrors?.rate}
          required
        />
        <FormField
          name="validFrom"
          label="Start date"
          type="date"
          value={values?.validFrom ?? today}
          errors={fieldErrors?.validFrom}
          required
        />
        <Button type="submit">Add rate</Button>
      </form>
      {rates.length === 0 ? (
        <EmptyState emoji="💰" title="No rates yet">
          Hours logged on this project have no billable amount until it has a rate.
        </EmptyState>
      ) : (
        <DataGrid
          columns={[
            { label: "Hourly rate" },
            { label: "Start date", kind: "fit" },
            { label: "End date", kind: "fit" },
            { kind: "action" },
          ]}
        >
          {ratePeriods(rates, today).map((period) => (
            <DataGrid.Row>
              <span>
                {formatAmount(period.rate / 100, consultant.currency, 2)}
                {period.isCurrent && <Badge class="ml-xs">Current</Badge>}
              </span>
              {formatDate(period.validFrom, "numeric")}
              {period.validUntil ? formatDate(period.validUntil, "numeric") : "No end date"}
              {period.validFrom > today ? (
                <DeleteRateForm ids={consultant} validFrom={period.validFrom} />
              ) : (
                ""
              )}
            </DataGrid.Row>
          ))}
        </DataGrid>
      )}
    </Page>
  );
}
