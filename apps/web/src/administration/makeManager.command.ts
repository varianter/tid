import { userRoles } from "@tid/db/schema";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
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
