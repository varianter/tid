import { clients } from "@tid/db/schema";
import { lookUpNordicCompany } from "@tid/lookup-nordic-company";
import { eq } from "drizzle-orm";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { returnTo } from "../framework/returnTo";
import { findClient, isOrganizationNumberTaken } from "./client.data";
import { confirmOrganizationNumberUrl, enterOrganizationNumberUrl } from "./clients.url";
import {
  ConfirmOrganizationNumberFormPage,
  confirmOrganizationNumberForm,
} from "./confirmOrganizationNumber.form";
import { countryOf, organizationNumberTaken } from "./organizationNumber";

export const confirmOrganizationNumber = formAction({
  schema: confirmOrganizationNumberForm,
  // Looks the number up again on confirming, so what's saved is what the register says, not what
  // the page sent.
  loader: async (c) => {
    const client = await findClient(c.req.param("id"));
    if (!client) return c.notFound();
    const enterAgain = enterOrganizationNumberUrl.path({
      clientId: client.id,
      returnTo: returnTo(c),
    });
    const page = confirmOrganizationNumberUrl.read(c.req.url);
    const country = page && countryOf(page.number);
    if (!page || !country) return c.redirect(enterAgain);
    const organizationNumber = page.number;
    const lookup = await lookUpNordicCompany(
      { country, organizationNumber },
      { key: process.env.ALTINN_LOOKUP_NORDICINFORMATION_API_KEY },
    );
    if (lookup.outcome === "unavailable")
      console.warn(`The company register couldn't be reached: ${lookup.reason}`);
    return {
      client,
      organizationNumber,
      lookup,
      enterAgain,
      done: returnTo(c, { client: String(client.id) }) ?? `/clients/${client.id}`,
    };
  },
  onSubmit: async (_c, _values, { client, organizationNumber, lookup, done }) => {
    if (await isOrganizationNumberTaken(organizationNumber, client.id))
      return { formError: organizationNumberTaken };
    if (lookup.outcome === "notFound")
      return { formError: "No company in the register has this number" };
    // The register answered when the page was shown, but not now.
    if (lookup.outcome === "unavailable")
      return { formError: "The company register can't be reached right now. Try again later." };
    await database
      .update(clients)
      .set({
        organizationNumber,
        legalName: lookup.company.name,
        registeredAddress: lookup.company.registeredAddress,
      })
      .where(eq(clients.id, client.id));
    return { redirect: done };
  },
  view: ConfirmOrganizationNumberFormPage,
});
