import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";
export const monthPath = (organizationSlug: string, month: string) =>
  `/end-of-the-month/${organizationSlug}/${month}`;

export const findOrganization = (c: Context<UserEnv>) =>
  findOrganizationBySlug(c.req.param("organization") ?? "");
