import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { countryVisibility } from "../managers/manager";
import { findOrganizationBySlug } from "../organizations/organization";
export const monthPath = (organizationSlug: string, month: string) =>
  `/end-of-the-month/${organizationSlug}/${month}`;

/** The organization in the URL, unless it's in a country the user may not see. */
export async function findOrganization(c: Context<UserEnv>) {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  const canViewCountry = await countryVisibility(c.get("user"));
  return organization && canViewCountry(organization.country) ? organization : undefined;
}
