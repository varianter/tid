import { userRoles } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { managersPath } from "./administration.url";
import { findMembership } from "./organizationMember.data";

// Nothing stops the last manager removing themselves; the role is then restored in the database.
export const removeManager = async (c: Context<UserEnv, "/managers/:userId/delete">) => {
  const membership = await findMembership(c.req.param("userId"));
  if (!membership) return c.notFound();
  await database
    .delete(userRoles)
    .where(and(eq(userRoles.userId, membership.userId), eq(userRoles.role, "manager")));
  return c.redirect(managersPath(membership.organization.slug), 303);
};
