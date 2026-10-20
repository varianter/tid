import { userRoles } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";

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

// For pages under an organization in the URL, which only its own managers may use.
export const organizationManagersOnly = createMiddleware<UserEnv>(async (c, next) => {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  if (!organization) return c.notFound();
  if (!(await managesOrganization(c.get("user"), organization.id))) {
    return c.text("Only the organization's managers can do this", 403);
  }
  await next();
});

// Any manager, since users and projects span organizations. What belongs to one organization,
// like its month locks or open projects, checks managesOrganization instead.
export const managersOnly = createMiddleware<UserEnv>(async (c, next) => {
  if (!(await isManager(c.get("user")))) return c.text("Only managers can do this", 403);
  await next();
});
