import { projectOrganizations } from "@tid/db/schema";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { participation, removeUnneededParticipation } from "../projects/projectParticipation";
import { openProjectsPath } from "./administrationUrl";
import { readOpenProjectChange } from "./openProjectChange";

export const closeProjectToMembers = async (c: Context<UserEnv>) => {
  const change = await readOpenProjectChange(c, c.req.param("projectId"));
  if (change instanceof Response) return change;
  const { organization, projectId } = change;
  await database.transaction(async (transaction) => {
    await transaction
      .update(projectOrganizations)
      .set({ openToMembers: false })
      .where(participation(projectId, organization.id));
    await removeUnneededParticipation(transaction, { projectId, orgId: organization.id });
  });
  return c.redirect(openProjectsPath(organization.slug), 303);
};
