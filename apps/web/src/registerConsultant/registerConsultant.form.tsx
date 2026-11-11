import { isIsoDate } from "@tid/calendar/isoDate";
import { Field, Form, FormField, FormPage, fieldErrorAttributes, Select } from "@tid/ui";
import { z } from "zod";
import { administrationPath } from "../administration/administration.url";
import type { OrganizationOption } from "../domain/organizations/organization";
import type { FormState } from "../framework/formAction";
import { emptyAsMissing } from "../framework/formValues";

export const registerConsultantForm = z.object({
  name: z.string().trim().min(1, "Enter their name"),
  email: z.string().trim().pipe(z.email("Enter their email address")),
  organizationId: z.preprocess(
    emptyAsMissing,
    z.coerce.number({ error: "Choose an organization" }).int(),
  ),
  firstDay: z.string().refine(isIsoDate, "Choose their first day"),
});

type RegisterConsultantFormPageProps = {
  organizations: OrganizationOption[];
  ownOrganizationId: number;
  form: FormState<typeof registerConsultantForm>;
};

export function RegisterConsultantFormPage({
  organizations,
  ownOrganizationId,
  form,
}: RegisterConsultantFormPageProps) {
  return (
    <FormPage
      title="Register a consultant"
      description="They can log in from their first day, without signing up."
    >
      <Form state={form} submit="Register consultant" cancel={administrationPath}>
        <FormField
          name="name"
          label="Name"
          value={form.values?.name}
          errors={form.fieldErrors.name}
          autocomplete="off"
          required
        />
        <FormField
          name="email"
          label="Variant email"
          type="email"
          value={form.values?.email}
          errors={form.fieldErrors.email}
          autocomplete="off"
          required
        />
        <Field name="organizationId" label="Organization" errors={form.fieldErrors.organizationId}>
          <Select
            id="organizationId"
            name="organizationId"
            required
            selected={form.values?.organizationId ?? ownOrganizationId}
            options={organizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
            {...fieldErrorAttributes("organizationId", form.fieldErrors.organizationId)}
          />
        </Field>
        <FormField
          name="firstDay"
          label="First day"
          type="date"
          value={form.values?.firstDay}
          errors={form.fieldErrors.firstDay}
          required
        />
      </Form>
    </FormPage>
  );
}
