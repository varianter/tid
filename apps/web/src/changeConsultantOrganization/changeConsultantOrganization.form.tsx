import { Field, Form, FormPage, fieldErrorAttributes, ReturnLink, Select } from "@tid/ui";
import { z } from "zod";
import { administrationPath } from "../administration/administration.url";
import type { OrganizationOption } from "../domain/organizations/organization";
import type { FormState } from "../framework/formAction";
import { emptyAsMissing } from "../framework/formValues";

export const changeConsultantOrganizationForm = z.object({
  organizationId: z.preprocess(
    emptyAsMissing,
    z.coerce.number({ error: "Choose an organization" }).int(),
  ),
});

type ChangeConsultantOrganizationFormPageProps = {
  consultant: { name: string; organization: { name: string } };
  blockers: string[];
  destinations: OrganizationOption[];
  form: FormState<typeof changeConsultantOrganizationForm>;
};

export function ChangeConsultantOrganizationFormPage({
  consultant,
  blockers,
  destinations,
  form,
}: ChangeConsultantOrganizationFormPageProps) {
  const { organization } = consultant;
  const blocked = blockers.length > 0;
  return (
    <FormPage
      title={`Change ${consultant.name}'s organization`}
      description={blocked ? undefined : `Now in ${organization.name}.`}
    >
      {blocked ? (
        <>
          <p>
            {consultant.name} stays in {organization.name}. Only someone who chose the wrong
            organization at sign-up, and hasn't started using Tid, can change it:
          </p>
          <ul class="stack-v gap-3xs w-max-3">
            {blockers.map((blocker) => (
              <li>{blocker}</li>
            ))}
          </ul>
          <ReturnLink href={administrationPath}>Back</ReturnLink>
        </>
      ) : (
        <Form state={form} submit="Change organization" cancel={administrationPath}>
          <Field
            name="organizationId"
            label="Organization"
            errors={form.fieldErrors.organizationId}
          >
            <Select
              id="organizationId"
              name="organizationId"
              required
              selected={form.values?.organizationId}
              options={destinations.map((destination) => ({
                value: destination.id,
                label: destination.name,
              }))}
              {...fieldErrorAttributes("organizationId", form.fieldErrors.organizationId)}
            >
              <option value="">Choose an organization</option>
            </Select>
          </Field>
        </Form>
      )}
    </FormPage>
  );
}
