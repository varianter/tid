import { todayInOslo } from "@tid/calendar/osloClock";
import { organizations, userRoles, users } from "@tid/db/schema";
import { and, eq, exists, gte, isNull, or } from "drizzle-orm";
import { database } from "../framework/database";
import { idParam } from "../framework/pageUrl";

/** Which organization the user belongs to. */
export async function findMembership(userIdParam: string) {
  const userId = idParam.safeParse(userIdParam);
  if (!userId.success) return undefined;
  const [membership] = await database
    .select({ userId: users.id, organization: { slug: organizations.slug } })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.id, userId.data));
  return membership;
}

/** The organization's people by name. Those who have left only when `includeLeft`. */
export const listOrganizationMembers = (orgId: number, { includeLeft = false } = {}) =>
  database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      endsOn: users.endsOn,
      isManager: exists(
        database
          .select()
          .from(userRoles)
          .where(and(eq(userRoles.userId, users.id), eq(userRoles.role, "manager"))),
      ).mapWith(Boolean),
    })
    .from(users)
    .where(
      and(
        eq(users.orgId, orgId),
        includeLeft ? undefined : or(isNull(users.endsOn), gte(users.endsOn, todayInOslo())),
      ),
    )
    .orderBy(users.name);
