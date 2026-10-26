import { isIsoDate } from "@tid/calendar/isoDate";
import { Button, FormField, Page } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";
import { type Consultant, projectRatesPath } from "./projectConsultant";

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

type AddRatePageProps = { consultant: Consultant; today: string } & FormProps;

export function AddRatePage({ consultant, today, values, fieldErrors }: AddRatePageProps) {
  return (
    <Page
      title={`New rate for ${consultant.name}`}
      back={{ href: projectRatesPath(consultant.projectId), label: "Back to rates" }}
    >
      <form method="post" class="stack-v items-start gap-m">
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
    </Page>
  );
}
