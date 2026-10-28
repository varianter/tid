import { FormField, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";
import type { Client } from "./client";

export const clientFields = z.object({ name: z.string().trim().min(1, "Enter a name") });

export const alreadyExists = { fieldErrors: { name: ["A client with this name already exists"] } };

type ClientFormPageProps = {
  client?: Client;
  /** The form a new client was asked for from, which cancelling goes back to. */
  returnTo?: string;
  form: FormState<typeof clientFields>;
};

/** Creates a client, or renames `client` when given. */
export function ClientFormPage({ client, returnTo, form }: ClientFormPageProps) {
  return (
    <FormPage
      form={form}
      layer="tooltip"
      {...(client
        ? { title: `Edit ${client.name}`, cancel: `/clients/${client.id}`, submit: "Save changes" }
        : { title: "New client", cancel: returnTo ?? "/clients", submit: "Create client" })}
    >
      <FormField
        name="name"
        label="Name"
        value={form.values?.name ?? client?.name}
        errors={form.fieldErrors.name}
        required
      />
    </FormPage>
  );
}
