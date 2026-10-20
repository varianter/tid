import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";

/** The organization in the URL and the project a change names. */
export async function readOpenProjectChange(c: Context<UserEnv>, projectIdText: unknown) {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  const projectId = Number(projectIdText);
  if (!organization || !Number.isSafeInteger(projectId)) return c.notFound();
  return { organization, projectId };
}
