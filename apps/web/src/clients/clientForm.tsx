import { Button, FormField, Page } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";
import type { Client } from "./client";

export const clientFields = z.object({ name: z.string().trim().min(1, "Enter a name") });

export const alreadyExists = { fieldErrors: { name: ["Already exists"] } };

/** Creates a client, or renames `client` when given. */
export function ClientFormPage({ client, values, fieldErrors }: { client?: Client } & FormProps) {
  return (
    <Page
      title={client ? `Edit ${client.name}` : "New client"}
      back={
        client
          ? { href: `/clients/${client.id}`, label: "Back to client" }
          : { href: "/clients", label: "Back to clients" }
      }
    >
      <form method="post" class="stack-v gap-m w-max-5">
        <FormField
          name="name"
          label="Name"
          value={values?.name ?? client?.name}
          errors={fieldErrors?.name}
          required
        />
        <Button type="submit" class="w-max-content">
          {client ? "Save changes" : "Create client"}
        </Button>
      </form>
    </Page>
  );
}
