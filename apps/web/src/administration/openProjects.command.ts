import { clients, projectOrganizations, projects } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import type { User } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";
import { listOrganizations } from "../organizations/organizationSelect";
import {
  ensureParticipation,
  participation,
  removeUnneededParticipation,
} from "../projects/projectParticipation";
import { openProjectsPath } from "./administrationUrl";
import { OpenProjectsPage, openProjectsForm } from "./openProjects.form";

export const chooseOpenProjects = formAction({
  schema: openProjectsForm,
  loader: async (c) => {
    const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
    if (!organization) return c.notFound();
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
      organizations: await listOrganizations(),
      ownOrgId: user.orgId,
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
    return { redirect: openProjectsPath(organization.slug) };
  },
  view: OpenProjectsPage,
});
