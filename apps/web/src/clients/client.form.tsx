import { Form, FormField, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";
import type { Client } from "./client";
import { OrganizationNumberField, organizationNumberField } from "./organizationNumber.form";

export const clientFields = z.object({ name: z.string().trim().min(1, "Enter a name") });

export const alreadyExists = { fieldErrors: { name: ["A client with this name already exists"] } };

// A new client's number is checked against the register in a step of its own, once the client exists.
export const addClientForm = clientFields.extend({ organizationNumber: organizationNumberField });

type ClientFormPageProps = {
  client?: Client;
  /** The form a new client was asked for from, which cancelling goes back to. */
  returnTo?: string;
  form: FormState<typeof clientFields | typeof addClientForm>;
};

/** Creates a client, or renames `client` when given. */
export function ClientFormPage({ client, returnTo, form }: ClientFormPageProps) {
  const { values, fieldErrors } = form;
  return (
    <FormPage layer="tooltip" title={client ? `Edit ${client.name}` : "New client"}>
      <Form
        state={form}
        {...(client
          ? { cancel: `/clients/${client.id}`, submit: "Save changes" }
          : { cancel: returnTo ?? "/clients", submit: "Create client" })}
      >
        <FormField
          name="name"
          label="Name"
          value={values?.name ?? client?.name}
          errors={fieldErrors.name}
          required
        />
        {!client && (
          <OrganizationNumberField
            value={values?.organizationNumber ?? ""}
            errors={fieldErrors.organizationNumber}
            hint="Optional. Norwegian or Swedish, looked up in the company register next."
          />
        )}
      </Form>
    </FormPage>
  );
}
