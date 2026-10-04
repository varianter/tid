import { Button, Field, FormField, fieldErrorAttributes, Page, Select } from "@tid/ui";
import type { FormProps } from "../form/formAction";

type OrganizationOption = { id: number; name: string };

export function SignupPage({
  email,
  organizations,
  values,
  fieldErrors,
}: { email: string; organizations: OrganizationOption[] } & FormProps) {
  return (
    <Page title="Welcome to Tid">
      <p class="w-max-5">
        You're logging in as {email} for the first time. Tell us who you are and which Variant
        organization you work for. You can't change the organization yourself later.
      </p>
      <form method="post" class="stack-v gap-m w-max-5">
        <FormField
          name="firstName"
          label="First name"
          value={values?.firstName}
          errors={fieldErrors?.firstName}
          autocomplete="given-name"
          required
        />
        <FormField
          name="lastName"
          label="Last name"
          value={values?.lastName}
          errors={fieldErrors?.lastName}
          autocomplete="family-name"
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
