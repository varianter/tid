import { projectOrganizations } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../../framework/database";
import { findOrganizationBySlug } from "../organizations/organization.data";
import type { User } from "../users/user";
import { countryVisibility } from "./manager";

/** The organization, unless it's in a country the user may not see. */
export async function findVisibleOrganization(user: User, slug: string) {
  const organization = await findOrganizationBySlug(slug);
  return organization && countryVisibility(user)(organization.country) ? organization : undefined;
}

/**
 * Whether the user is a manager in an organization taking part in the project. They share its
 * details, tasks, consultants and rates. A project no organization takes part in yet, like a new
 * non-billable one, is any manager's, so it isn't left without anyone who can change it.
 */
export async function managesProject(user: User, projectId: number) {
  const participants = await database
    .select({ orgId: projectOrganizations.orgId })
    .from(projectOrganizations)
    .where(eq(projectOrganizations.projectId, projectId));
  const takesPart =
    participants.length === 0 || participants.some(({ orgId }) => orgId === user.orgId);
  return takesPart && user.isManager;
}
