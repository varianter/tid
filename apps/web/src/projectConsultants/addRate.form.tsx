import { isIsoDate } from "@tid/calendar/isoDate";
import { FormField } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../framework/formAction";
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

type AddRateProps = { consultant: Consultant; today: string };

export const addRateFrame = ({ consultant }: AddRateProps) => ({
  title: `New rate for ${consultant.name}`,
  cancel: projectRatesPath(consultant.projectId),
  submit: "Add rate",
  layer: "tooltip" as const,
});

export function AddRateFields({
  consultant,
  today,
  values,
  fieldErrors,
}: AddRateProps & FormProps) {
  return (
    <>
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
    </>
  );
}
