import { isIsoDate } from "@tid/calendar/isoDate";
import { FormField, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";
import type { Consultant } from "./projectConsultant";
import { projectRatesPath } from "./projectConsultants.url";

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

type AddRateFormPageProps = {
  consultant: Consultant;
  today: string;
  form: FormState<typeof addRateForm>;
};

export function AddRateFormPage({ consultant, today, form }: AddRateFormPageProps) {
  return (
    <FormPage
      title={`New rate for ${consultant.name}`}
      cancel={projectRatesPath(consultant.projectId)}
      submit="Add rate"
      form={form}
      layer="tooltip"
      width={5}
    >
      <FormField
        name="rate"
        label={`Hourly rate (${consultant.currency})`}
        type="number"
        min="0"
        step="0.01"
        value={form.values?.rate}
        errors={form.fieldErrors.rate}
        required
      />
      <FormField
        name="validFrom"
        label="Start date"
        type="date"
        value={form.values?.validFrom ?? today}
        errors={form.fieldErrors.validFrom}
        required
      />
    </FormPage>
  );
}
