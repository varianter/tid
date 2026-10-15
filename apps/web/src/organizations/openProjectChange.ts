import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { managesOrganization } from "../users/manager";
import { findOrganizationBySlug } from "./organization";

export const openProjectsPath = (organizationSlug: string) =>
  `/organizations/${organizationSlug}/projects`;

/** The project a change names, once the user manages the organization in the URL. */
export async function readOpenProjectChange(c: Context<UserEnv>, projectIdText: unknown) {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  const projectId = Number(projectIdText);
  if (!organization || !Number.isSafeInteger(projectId)) return c.notFound();
  if (!(await managesOrganization(c.get("user"), organization.id))) {
    return c.text("Only the organization's managers can do this", 403);
  }
  return { organization, projectId };
}
