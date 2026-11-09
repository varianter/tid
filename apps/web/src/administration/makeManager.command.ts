import { userRoles } from "@tid/db/schema";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { managersPath } from "./administration.url";
import { findMembership } from "./organizationMember.data";

export const makeManager = async (c: Context<UserEnv, "/managers/:userId">) => {
  const membership = await findMembership(c.req.param("userId"));
  if (!membership) return c.notFound();
  await database
    .insert(userRoles)
    .values({ userId: membership.userId, role: "manager" })
    .onConflictDoNothing();
  return c.redirect(managersPath(membership.organization.slug), 303);
};
