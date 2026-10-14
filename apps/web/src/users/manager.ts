import { userRoles } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { database } from "../database";
import type { User } from "../login/user";

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
