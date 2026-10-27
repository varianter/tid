import { organizations, userIdentities, userRoles, users } from "@tid/db/schema";
import { and, eq, exists, getTableColumns, sql } from "drizzle-orm";
import type { User } from "../domain/users/user";
import { database } from "../framework/database";

export const identityProvider = "entra";

// One query for everything login hands on, since it runs on every request.
const selectUsers = () =>
  database
    .select({
      ...getTableColumns(users),
      organization: getTableColumns(organizations),
      isManager: exists(
        database
          .select()
          .from(userRoles)
          .where(and(eq(userRoles.userId, users.id), eq(userRoles.role, "manager"))),
      ).mapWith(Boolean),
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId));

export async function findUserByIdentity(
  tenantId: string,
  subject: string,
): Promise<User | undefined> {
  const [user] = await selectUsers()
    .innerJoin(userIdentities, eq(userIdentities.userId, users.id))
    .where(
      and(
        eq(userIdentities.provider, identityProvider),
        eq(userIdentities.tenantId, tenantId),
        eq(userIdentities.subject, subject),
      ),
    );
  return user;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await selectUsers().where(sql`lower(${users.email}) = lower(${email})`);
  return user;
}

// Imported users have no identity until their first login, so they are matched on email.
export async function linkIdentity(tenantId: string, subject: string, user: User) {
  const [identity] = await database
    .insert(userIdentities)
    .values({ userId: user.id, provider: identityProvider, tenantId, subject })
    // Conflicts when concurrent first requests race, or when the email now belongs to someone
    // other than the subject the user is already linked to. Only the stored owner may log in.
    .onConflictDoNothing()
    .returning();
  if (identity) return user;
  const owner = await findUserByIdentity(tenantId, subject);
  return owner?.id === user.id ? user : undefined;
}
