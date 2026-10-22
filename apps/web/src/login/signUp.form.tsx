import { Button, Field, FormField, fieldErrorAttributes, Page, Select } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";

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

export function SignUpPage({
  email,
  name,
  organizations,
  values,
  fieldErrors,
}: SignUpProps & FormProps) {
  return (
    <Page title="Welcome to Tid">
      <p class="w-max-5">
        You're logging in as {email} for the first time. Tell us who you are and which Variant
        organization you work for. You can't change the organization yourself later, so ask a
        manager if it needs changing.
      </p>
      <form method="post" class="stack-v gap-m w-max-5">
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
            {...fieldErrorAttributes("organizationId", fieldErrors?.organizationId)}
          >
            <option value="">Choose your organization</option>
            {organizations.map((organization) => (
              <option
                value={organization.id}
                selected={String(organization.id) === values?.organizationId}
              >
                {organization.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" class="w-max-content">
          Start using Tid
        </Button>
      </form>
    </Page>
  );
}

export function NotAnEmployeePage({ email }: { email: string }) {
  return (
    <Page title="Tid is for Variant employees">
      <p class="w-max-5">{email} isn't a Variant email address, so it can't be used to sign up.</p>
    </Page>
  );
}
