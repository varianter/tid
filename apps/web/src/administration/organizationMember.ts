import { users } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { userIdParam } from "../consultants/consultantsUrl";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";

/** The user in the URL, as long as they belong to the organization in the URL. */
export async function findOrganizationMember(c: Context<UserEnv>) {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  const userId = userIdParam(c);
  if (!organization || userId === undefined) return undefined;
  const [member] = await database
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, organization.id)));
  return member && { organization, userId: member.id };
}
