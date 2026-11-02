import { clients } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { returnTo } from "../framework/returnTo";
import { findClient, isOrganizationNumberTaken } from "./client.data";
import { confirmOrganizationNumberUrl } from "./clients.url";
import {
  EnterOrganizationNumberFormPage,
  enterOrganizationNumberForm,
} from "./enterOrganizationNumber.form";
import { organizationNumberTaken } from "./organizationNumber";

export const enterOrganizationNumber = formAction({
  schema: enterOrganizationNumberForm,
  loader: async (c) => {
    const client = await findClient(c.req.param("id"));
    if (!client) return c.notFound();
    return {
      client,
      done: returnTo(c, { client: String(client.id) }) ?? `/clients/${client.id}`,
    };
  },
  onSubmit: async (c, { organizationNumber }, { client, done }) => {
    if (!organizationNumber) {
      await database
        .update(clients)
        .set({ organizationNumber: null, legalName: null, registeredAddress: null })
        .where(eq(clients.id, client.id));
      return { redirect: done };
    }
    // Checked before the lookup, so a number that can't be saved costs no call to the register.
    if (await isOrganizationNumberTaken(organizationNumber, client.id))
      return { fieldErrors: { organizationNumber: [organizationNumberTaken] } };
    return {
      redirect: confirmOrganizationNumberUrl.path({
        clientId: client.id,
        number: organizationNumber,
        returnTo: returnTo(c),
      }),
    };
  },
  view: EnterOrganizationNumberFormPage,
});
