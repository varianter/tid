import { FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";
import type { Client } from "./client";
import { formatOrganizationNumber } from "./organizationNumber";
import { OrganizationNumberField, organizationNumberField } from "./organizationNumber.form";

export const enterOrganizationNumberForm = z.object({
  organizationNumber: organizationNumberField,
});

type EnterOrganizationNumberFormPageProps = {
  client: Client;
  /** Where the steps end, which cancelling goes to. */
  done: string;
  form: FormState<typeof enterOrganizationNumberForm>;
};

export function EnterOrganizationNumberFormPage({
  client,
  done,
  form,
}: EnterOrganizationNumberFormPageProps) {
  const { values, fieldErrors } = form;
  return (
    <FormPage
      form={form}
      layer="tooltip"
      title={`Organization number for ${client.name}`}
      description="We'll pull information from official sources."
      cancel={done}
      submit="Look up"
    >
      <OrganizationNumberField
        value={
          values?.organizationNumber ??
          (client.organizationNumber ? formatOrganizationNumber(client.organizationNumber) : "")
        }
        errors={fieldErrors.organizationNumber}
        hint={client.organizationNumber ? "Leave it empty to remove it." : undefined}
      />
    </FormPage>
  );
}
