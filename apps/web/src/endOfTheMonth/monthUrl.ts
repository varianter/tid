import { z } from "zod";
import type { User } from "../login/user";
import { countryVisibility } from "../managers/manager";
import { findOrganizationBySlug } from "../organizations/organization";
import { monthParam } from "../query/pageMonth";
import { pageUrl } from "../query/pageUrl";

export const monthUrl = pageUrl(
  "/end-of-the-month/:organization/:month",
  z.object({ organization: z.string(), month: monthParam }),
);

/** The organization, unless it's in a country the user may not see. */
export async function findOrganization(user: User, slug: string) {
  const organization = await findOrganizationBySlug(slug);
  const canViewCountry = await countryVisibility(user);
  return organization && canViewCountry(organization.country) ? organization : undefined;
}
