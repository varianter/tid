import { clients, projectOrganizations, projects } from "@tid/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { listOrganizations } from "../organizations/organizationSelect";
import { billableCountsTowardBase, ProjectFormPage, projectFields } from "./projectForm";
import {
  ensureParticipation,
  participation,
  removeUnneededParticipation,
} from "./projectParticipation";

// The client is fixed once the project exists.
const editProjectForm = billableCountsTowardBase(projectFields);

export const editProject = formAction({
  schema: editProjectForm,
  loader: async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isSafeInteger(id)) return c.notFound();
    const [project] = await database
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        client: clients.name,
        billable: projects.billable,
        countsTowardBillableBase: projects.countsTowardBillableBase,
        contractOwnerId: projectOrganizations.orgId,
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .innerJoin(
        projectOrganizations,
        and(
          eq(projectOrganizations.projectId, projects.id),
          eq(projectOrganizations.isContractOwner, true),
        ),
      )
      .where(eq(projects.id, id));
    if (!project) return c.notFound();
    return {
      project,
      organizations: await listOrganizations(),
      contractOwnerId: project.contractOwnerId,
    };
  },
  onSubmit: async (_c, { contractOwnerId, ...form }, { project, organizations }) => {
    if (!organizations.some((organization) => organization.id === contractOwnerId)) {
      return { fieldErrors: { contractOwnerId: ["Pick an organization"] } };
    }
    const openToMembers = await database.$count(
      projectOrganizations,
      and(
        eq(projectOrganizations.projectId, project.id),
        eq(projectOrganizations.openToMembers, true),
      ),
    );
    if (form.billable && openToMembers) {
      return { formError: "Projects open to an organization's members can't be billable" };
    }
    try {
      await database.transaction(async (transaction) => {
        await transaction.update(projects).set(form).where(eq(projects.id, project.id));
        if (contractOwnerId === project.contractOwnerId) return;
        // Cleared first: the unique index allows one contract owner per project.
        await transaction
          .update(projectOrganizations)
          .set({ isContractOwner: false })
          .where(participation(project.id, project.contractOwnerId));
        const newOwner = { projectId: project.id, orgId: contractOwnerId };
        await ensureParticipation(transaction, newOwner);
        await transaction
          .update(projectOrganizations)
          .set({ isContractOwner: true })
          .where(participation(project.id, contractOwnerId));
        await removeUnneededParticipation(transaction, {
          projectId: project.id,
          orgId: project.contractOwnerId,
        });
      });
    } catch {
      // ponytail: assumes a unique violation; any other failure reads as a name clash.
      const codeTaken = await database.$count(
        projects,
        and(eq(projects.code, form.code), ne(projects.id, project.id)),
      );
      return codeTaken
        ? { fieldErrors: { code: ["Already in use"] } }
        : { fieldErrors: { name: ["The client already has a project with this name"] } };
    }
    return { redirect: `/projects/${project.id}` };
  },
  view: ProjectFormPage,
});
