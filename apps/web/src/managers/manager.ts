import type { Country } from "@tid/calendar/publicHolidays";
import { projectOrganizations, userRoles } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { findOrganizationBySlug, findOrganizationCountry } from "../organizations/organization";

export async function isManager(user: User) {
  const roles = await database
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, "manager")));
  return roles.length > 0;
}

/** Whether the user is a manager in the organization; managers only manage their own. */
export async function managesOrganization(user: User, orgId: number) {
  return user.orgId === orgId && isManager(user);
}

/**
 * Which countries the user may see: managers every country, everyone else only their own
 * organization's. Pages showing a country's or an organization's data filter with it.
 */
export async function countryVisibility(user: User) {
  const [ownCountry, userIsManager] = await Promise.all([
    findOrganizationCountry(user.orgId),
    isManager(user),
  ]);
  return (country: Country) => userIsManager || country === ownCountry;
}

/**
 * Whether the user is a manager in an organization taking part in the project. They share its
 * details, tasks, consultants and rates.
 */
export async function managesProject(user: User, projectId: number) {
  const participates = await database.$count(
    projectOrganizations,
    and(eq(projectOrganizations.projectId, projectId), eq(projectOrganizations.orgId, user.orgId)),
  );
  return participates > 0 && isManager(user);
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

// For pages under an organization in the URL, which only its own managers may use.
export const organizationManagersOnly = createMiddleware<UserEnv>(async (c, next) => {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  if (!organization) return c.notFound();
  if (!(await managesOrganization(c.get("user"), organization.id))) {
    return c.text("Only the organization's managers can do this", 403);
  }
  await next();
});

// Any manager, for what belongs to no organization, like clients and new projects. What belongs to
// one organization checks managesOrganization instead, and what belongs to a project managesProject.
export const managersOnly = createMiddleware<UserEnv>(async (c, next) => {
  if (!(await isManager(c.get("user")))) return c.text("Only managers can do this", 403);
  await next();
});
