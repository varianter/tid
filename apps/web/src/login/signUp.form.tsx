import { Field, FormField, fieldErrorAttributes, Select } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../framework/formAction";

export const signUpForm = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  organizationId: z.coerce.number().int(),
});

type OrganizationOption = { id: number; name: string };

export type SignUpProps = {
  subject: string;
  email: string;
  name?: string;
  organizations: OrganizationOption[];
};

export const signUpFrame = () => ({ title: "Welcome to Tid", submit: "Start using Tid" });

export function SignUpFields({
  email,
  name,
  organizations,
  values,
  fieldErrors,
}: SignUpProps & FormProps) {
  return (
    <>
      <p class="w-max-5">
        You're logging in as {email} for the first time. Tell us who you are and which Variant
        organization you work for. You can't change the organization yourself later, so ask a
        manager if it needs changing.
      </p>
      <FormField
        name="name"
        label="Name"
        value={values?.name ?? name}
        errors={fieldErrors?.name}
        autocomplete="name"
        required
      />
      <Field name="organizationId" label="Organization" errors={fieldErrors?.organizationId}>
        <Select
          id="organizationId"
          name="organizationId"
          required
          selected={values?.organizationId}
          options={organizations.map((organization) => ({
            value: organization.id,
            label: organization.name,
          }))}
          {...fieldErrorAttributes("organizationId", fieldErrors?.organizationId)}
        >
          <option value="">Choose your organization</option>
        </Select>
      </Field>
    </>
  );
}
