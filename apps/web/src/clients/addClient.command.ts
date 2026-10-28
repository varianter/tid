import { clients } from "@tid/db/schema";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { returnTo } from "../framework/returnTo";
import { alreadyExists, ClientFormPage, clientFields } from "./client.form";

export const addClient = formAction({
  schema: clientFields,
  loader: async (c) => ({ returnTo: returnTo(c) }),
  onSubmit: async (c, { name }) => {
    const [inserted] = await database
      .insert(clients)
      .values({ name })
      .onConflictDoNothing()
      .returning();
    if (!inserted) return alreadyExists;
    // A form that sent someone here to add a client gets it back, chosen.
    return { redirect: returnTo(c, { client: String(inserted.id) }) ?? `/clients/${inserted.id}` };
  },
  view: ClientFormPage,
});
