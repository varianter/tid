import { clients } from "@tid/db/schema";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { alreadyExists, ClientFields, clientFields, clientFrame } from "./client.form";

export const addClient = formAction({
  schema: clientFields,
  loader: async () => ({}),
  onSubmit: async (_c, { name }) => {
    const [inserted] = await database
      .insert(clients)
      .values({ name })
      .onConflictDoNothing()
      .returning();
    return inserted ? { redirect: `/clients/${inserted.id}` } : alreadyExists;
  },
  frame: clientFrame,
  view: ClientFields,
});
