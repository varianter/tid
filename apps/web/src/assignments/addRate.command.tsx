import { formatDate } from "@tid/calendar/dateDisplay";
import { isIsoDate } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import { assignmentRates } from "@tid/db/schema";
import { Badge, Button, DataGrid, EmptyState, FormField, Page } from "@tid/ui";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { formatAmount } from "../amount/amount";
import { database } from "../database";
import { type FormProps, formAction } from "../form/formAction";
import { type Consultant, idParams, loadConsultant, ratesOf, ratesPath } from "./assignment";
import { DeleteRateForm } from "./deleteRate.command";
import { ratePeriods } from "./ratePeriods";
import { addRateAndReprice, entriesToReprice } from "./repricing";

const addRateForm = z.object({
  rate: z
    .string()
    .trim()
    .min(1, "Enter a rate")
    .transform(Number)
    .pipe(z.number("Enter a number").min(0, "Can't be negative"))
    // Stored in minor units.
    .transform((rate) => Math.round(rate * 100)),
  validFrom: z.string().refine(isIsoDate, "Pick a date"),
});

export const addRate = formAction({
  schema: addRateForm,
  loader: async (c) => {
    const ids = idParams(c.req.param());
    if (!ids) return c.notFound();
    const consultant = await loadConsultant(ids);
    if (!consultant) return c.notFound();
    const rates = await database
      .select({ validFrom: assignmentRates.validFrom, rate: assignmentRates.rate })
      .from(assignmentRates)
      .where(ratesOf(ids))
      .orderBy(desc(assignmentRates.validFrom));
    return { consultant, rates, today: todayInOslo() };
  },
  // A rate that changes logged time is confirmed on its own page first.
  onSubmit: async (_c, form, { consultant }) => {
    const newRate = { ...form, currency: consultant.currency };
    if ((await entriesToReprice(consultant, newRate)).length > 0) {
      const query = new URLSearchParams({ validFrom: form.validFrom, rate: String(form.rate) });
      return { redirect: `${ratesPath(consultant)}/reprice?${query}` };
    }
    await addRateAndReprice(consultant, newRate);
    return { redirect: ratesPath(consultant) };
  },
  view: RatesPage,
});

type RatesPageProps = {
  consultant: Consultant;
  rates: { validFrom: string; rate: number }[];
  today: string;
} & FormProps;

function RatesPage({ consultant, rates, today, values, fieldErrors }: RatesPageProps) {
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
        <Button type="submit">New billable rate</Button>
      </form>
      {rates.length === 0 ? (
        <EmptyState emoji="💰" title="No rates yet">
          Time logged on this project has no billable amount until it has a rate.
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
              {period.validUntil ? formatDate(period.validUntil, "numeric") : "All future"}
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
