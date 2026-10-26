import { clients } from "@tid/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { findClient } from "./client.data";
import { alreadyExists, ClientFields, clientFields, clientFrame } from "./client.form";

export const renameClient = formAction({
  schema: clientFields,
  loader: async (c) => {
    const client = await findClient(c.req.param("id"));
    return client ? { client } : c.notFound();
  },
  onSubmit: async (_c, { name }, { client }) => {
    const nameTaken = await database.$count(
      clients,
      and(eq(clients.name, name), ne(clients.id, client.id)),
    );
    if (nameTaken) return alreadyExists;
    await database.update(clients).set({ name }).where(eq(clients.id, client.id));
    return { redirect: `/clients/${client.id}` };
  },
  frame: clientFrame,
  view: ClientFields,
});
