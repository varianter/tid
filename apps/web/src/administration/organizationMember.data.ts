import { users } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { database } from "../database";
import { findOrganizationBySlug } from "../organizations/organization.data";

/** The user, as long as they belong to the organization. */
export async function findOrganizationMember(slug: string, userIdParam: string) {
  const userId = Number(userIdParam);
  if (!Number.isSafeInteger(userId)) return undefined;
  const organization = await findOrganizationBySlug(slug);
  if (!organization) return undefined;
  const [member] = await database
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, organization.id)));
  return member && { organization, userId: member.id };
}
