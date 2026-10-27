import { userRoles } from "@tid/db/schema";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { managersPath } from "./administration.url";
import { findOrganizationMember } from "./organizationMember.data";

export const makeManager = async (c: Context<UserEnv, "/:organization/managers/:userId">) => {
  const member = await findOrganizationMember(c.req.param("organization"), c.req.param("userId"));
  if (!member) return c.notFound();
  await database
    .insert(userRoles)
    .values({ userId: member.userId, role: "manager" })
    .onConflictDoNothing();
  return c.redirect(managersPath(member.organization.slug), 303);
};
