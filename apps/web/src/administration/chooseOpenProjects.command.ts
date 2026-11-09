import { clients, projectOrganizations, projects } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "../domain/users/user";
import { database } from "../framework/database";
import { formAction, withSaved } from "../framework/formAction";
import {
  ensureParticipation,
  participation,
  removeUnneededParticipation,
} from "../projects/projectParticipation.data";
import { resolveAdministeredOrganization } from "./administeredOrganization.data";
import { openProjectsPath } from "./administration.url";
import { ChooseOpenProjectsFormPage, chooseOpenProjectsForm } from "./chooseOpenProjects.form";

export const chooseOpenProjects = formAction({
  schema: chooseOpenProjectsForm,
  loader: async (c) => {
    const administered = await resolveAdministeredOrganization(c);
    if (administered instanceof Response) return administered;
    const { organization, filter } = administered;
    const user: User = c.get("user");
    const openableProjects = await database
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        client: clients.name,
        openToMembers: projectOrganizations.openToMembers,
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(projectOrganizations, participation(projects.id, organization.id))
      .where(eq(projects.billing, "non_billable"))
      .orderBy(clients.name, projects.name);
    return {
      organization,
      projects: openableProjects.map(({ openToMembers, ...project }) => ({
        ...project,
        open: openToMembers ?? false,
      })),
      filter,
      own: user.organization,
    };
  },
  // Only non-billable projects are listed, so a ticked billable one is never opened.
  onSubmit: async (_c, form, { organization, projects: openableProjects }) => {
    const chosen = new Set(form.projectId);
    await database.transaction(async (transaction) => {
      for (const project of openableProjects) {
        const open = chosen.has(project.id);
        if (open === project.open) continue;
        const ids = { projectId: project.id, orgId: organization.id };
        if (open) await ensureParticipation(transaction, ids);
        await transaction
          .update(projectOrganizations)
          .set({ openToMembers: open })
          .where(participation(project.id, organization.id));
        if (!open) await removeUnneededParticipation(transaction, ids);
      }
    });
    return { redirect: withSaved(openProjectsPath(organization.slug)) };
  },
  view: ChooseOpenProjectsFormPage,
});
