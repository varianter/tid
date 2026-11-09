import type { Context } from "hono";
import { resolveOrganizationFilter } from "../domain/organizations/organizationFilter";
import type { UserEnv } from "../domain/users/user";

/**
 * The organization an administration page is about, from `?organization=`. Without one, it
 * redirects to the manager's own. Whole countries aren't offered, since each page changes one.
 */
export async function resolveAdministeredOrganization(c: Context<UserEnv>) {
  const filter = await resolveOrganizationFilter(c, { wholeCountries: false });
  if (filter instanceof Response) return filter;
  // Without whole countries, every option is exactly one organization.
  const [organization] = filter.selected.organizations;
  if (!organization) throw new Error(`${filter.selected.name} has no organization`);
  return { organization, filter };
}
