import { userIdentities, users } from "@tid/db/schema";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { database } from "../database";
import type { User } from "./user";

export const identityProvider = "entra";

export async function findUserByIdentity(tenantId: string, subject: string) {
  const [user] = await database
    .select(getTableColumns(users))
    .from(users)
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

export async function findUserByEmail(email: string) {
  const [user] = await database
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);
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
