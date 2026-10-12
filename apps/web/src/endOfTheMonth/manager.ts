import { userRoles } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { database } from "../database";
import type { User } from "../login/user";

/** Whether the user is a manager in the organization; managers only manage their own. */
export async function managesOrganization(user: User, orgId: number) {
  if (user.orgId !== orgId) return false;
  const roles = await database
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, "manager")));
  return roles.length > 0;
}
