import type { Country } from "@tid/calendar/publicHolidays";
import type { User } from "../users/user";

/** Whether the user is a manager in the organization; managers only manage their own. */
export function managesOrganization(user: User, orgId: number) {
  return user.orgId === orgId && user.isManager;
}

/**
 * Which countries the user may see: managers every country, everyone else only their own
 * organization's. Pages showing a country's or an organization's data filter with it.
 */
export function countryVisibility(user: User) {
  return (country: Country) => user.isManager || country === user.organization.country;
}
