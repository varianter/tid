import { userRoles } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { managersPath } from "./administrationUrl";
import { findOrganizationMember } from "./organizationMember";

// Nothing stops the last manager removing themselves; the role is then restored in the database.
export const removeManager = async (c: Context<UserEnv>) => {
  const member = await findOrganizationMember(c);
  if (!member) return c.notFound();
  await database
    .delete(userRoles)
    .where(and(eq(userRoles.userId, member.userId), eq(userRoles.role, "manager")));
  return c.redirect(managersPath(member.organization.slug), 303);
};
