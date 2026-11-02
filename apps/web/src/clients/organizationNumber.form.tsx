import { Field, fieldErrorAttributes, Input } from "@tid/ui";
import { z } from "zod";
import { emptyAsMissing } from "../framework/formValues";
import { organizationNumberDigits } from "./organizationNumber";

/** An organization number as typed into a form, read as digits. Empty means none. */
export const organizationNumberField = z.preprocess(
  (value) => emptyAsMissing(typeof value === "string" ? value.trim() : value),
  organizationNumberDigits.optional(),
);

/** The input `organizationNumberField` reads. */
export function OrganizationNumberField({
  value,
  errors,
  hint,
}: {
  value: string;
  errors: string[] | undefined;
  hint?: string;
}) {
  return (
    <Field name="organizationNumber" label="Organization number" errors={errors}>
      <Input
        id="organizationNumber"
        name="organizationNumber"
        value={value}
        inputmode="numeric"
        {...fieldErrorAttributes("organizationNumber", errors)}
      />
      {hint && <p class="fs-s ink-subtle mt-3xs">{hint}</p>}
    </Field>
  );
}
