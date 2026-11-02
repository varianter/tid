import { clients } from "@tid/db/schema";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { returnTo } from "../framework/returnTo";
import { isOrganizationNumberTaken } from "./client.data";
import { addClientForm, alreadyExists, ClientFormPage } from "./client.form";
import { confirmOrganizationNumberUrl } from "./clients.url";
import { organizationNumberTaken } from "./organizationNumber";

export const addClient = formAction({
  schema: addClientForm,
  loader: async (c) => ({ returnTo: returnTo(c) }),
  onSubmit: async (c, { name, organizationNumber }) => {
    if (organizationNumber && (await isOrganizationNumberTaken(organizationNumber)))
      return { fieldErrors: { organizationNumber: [organizationNumberTaken] } };
    const [inserted] = await database
      .insert(clients)
      .values({ name })
      .onConflictDoNothing()
      .returning();
    if (!inserted) return alreadyExists;
    // The number is saved once it's been looked up in the register.
    if (organizationNumber)
      return {
        redirect: confirmOrganizationNumberUrl.path({
          clientId: inserted.id,
          number: organizationNumber,
          returnTo: returnTo(c),
        }),
      };
    // A form that sent someone here to add a client gets it back, chosen.
    return { redirect: returnTo(c, { client: String(inserted.id) }) ?? `/clients/${inserted.id}` };
  },
  view: ClientFormPage,
});
