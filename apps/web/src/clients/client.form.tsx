import { FormField } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../framework/formAction";
import type { Client } from "./client";

export const clientFields = z.object({ name: z.string().trim().min(1, "Enter a name") });

export const alreadyExists = { fieldErrors: { name: ["A client with this name already exists"] } };

/** Creates a client, or renames `client` when given. */
export const clientFrame = ({ client }: { client?: Client }) =>
  client
    ? { title: `Edit ${client.name}`, cancel: `/clients/${client.id}`, submit: "Save changes" }
    : { title: "New client", cancel: "/clients", submit: "Create client" };

export function ClientFields({ client, values, fieldErrors }: { client?: Client } & FormProps) {
  return (
    <FormField
      name="name"
      label="Name"
      value={values?.name ?? client?.name}
      errors={fieldErrors?.name}
      required
    />
  );
}
