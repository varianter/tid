import { projectOrganizations, projects } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { ensureParticipation, participation } from "../projects/projectParticipation";
import { openProjectsPath } from "./administrationUrl";
import { readOpenProjectChange } from "./openProjectChange";

export const openProjectToMembers = async (c: Context<UserEnv>) => {
  const change = await readOpenProjectChange(c, (await c.req.parseBody()).projectId);
  if (change instanceof Response) return change;
  const { organization, projectId } = change;
  const [project] = await database
    .select({ billing: projects.billing })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return c.notFound();
  if (project.billing !== "non_billable") {
    return c.text(
      `Only non-billable projects can be open to everyone in ${organization.name}`,
      400,
    );
  }
  await database.transaction(async (transaction) => {
    await ensureParticipation(transaction, { projectId, orgId: organization.id });
    await transaction
      .update(projectOrganizations)
      .set({ openToMembers: true })
      .where(participation(projectId, organization.id));
  });
  return c.redirect(openProjectsPath(organization.slug), 303);
};
