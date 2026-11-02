import { clientAccountManagers } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { listCurrentPeople } from "../domain/users/user.data";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import {
  ChooseAccountManagersFormPage,
  chooseAccountManagersForm,
} from "./chooseAccountManagers.form";
import { findClient, listAccountManagers } from "./client.data";

export const chooseAccountManagers = formAction({
  schema: chooseAccountManagersForm,
  loader: async (c) => {
    const client = await findClient(c.req.param("id"));
    if (!client) return c.notFound();
    const chosenIds = (await listAccountManagers(client.id)).map((person) => person.id);
    const people = await listCurrentPeople(chosenIds);
    return {
      client,
      people: people.map((person) => ({ ...person, chosen: chosenIds.includes(person.id) })),
    };
  },
  onSubmit: async (_c, { userId }, { client, people }) => {
    const chosen = new Set(userId);
    if (![...chosen].every((id) => people.some((person) => person.id === id))) {
      return { fieldErrors: { userId: ["Someone you chose can't be chosen. Choose again."] } };
    }
    await database.transaction(async (transaction) => {
      await transaction
        .delete(clientAccountManagers)
        .where(eq(clientAccountManagers.clientId, client.id));
      if (chosen.size === 0) return;
      await transaction
        .insert(clientAccountManagers)
        .values([...chosen].map((id) => ({ clientId: client.id, userId: id })));
    });
    return { redirect: `/clients/${client.id}` };
  },
  view: ChooseAccountManagersFormPage,
});
