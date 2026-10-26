import type { Country } from "@tid/calendar/publicHolidays";
import { projectOrganizations } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";

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

// For pages under a project in the URL, as `:id` or, for nested routes, `:projectId`.
export const projectManagersOnly = createMiddleware<UserEnv>(async (c, next) => {
  const projectId = Number(c.req.param("projectId") ?? c.req.param("id"));
  if (!Number.isSafeInteger(projectId)) return c.notFound();
  if (!(await managesProject(c.get("user"), projectId))) {
    return c.text("Only managers of the project's organizations can do this", 403);
  }
  await next();
});

// Any manager, for what belongs to no organization, like clients and new projects, and for
// administering any organization. Month locks check managesOrganization instead, and what belongs
// to a project managesProject.
export const managersOnly = createMiddleware<UserEnv>(async (c, next) => {
  if (!c.get("user").isManager) return c.text("Only managers can do this", 403);
  await next();
});
