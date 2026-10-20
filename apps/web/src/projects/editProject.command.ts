import { clients, projectOrganizations, projects, tasks, timeEntries } from "@tid/db/schema";
import { and, eq, exists, ne } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { listOrganizations } from "../organizations/organizationSelect";
import { editProjectForm, ProjectFormPage } from "./project.form";
import { listProjectCurrencies } from "./projectCurrency";
import {
  ensureParticipation,
  participation,
  removeUnneededParticipation,
} from "./projectParticipation";

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
        billing: projects.billing,
        currency: projects.currency,
        countsTowardBillableBase: projects.countsTowardBillableBase,
        hasLoggedTime: exists(
          database
            .select()
            .from(timeEntries)
            .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
            .where(eq(tasks.projectId, projects.id)),
        ).mapWith(Boolean),
        contractOwnerId: projectOrganizations.orgId,
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(
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
      currencies: await listProjectCurrencies(),
      currency: project.currency,
      contractOwnerId: project.contractOwnerId,
    };
  },
  onSubmit: async (
    _c,
    { contractOwnerId = null, ...form },
    { project, organizations, currencies },
  ) => {
    if (!currencies.includes(form.currency)) {
      return { fieldErrors: { currency: ["Pick a currency"] } };
    }
    if (
      contractOwnerId !== null &&
      !organizations.some((organization) => organization.id === contractOwnerId)
    ) {
      return { fieldErrors: { contractOwnerId: ["Pick an organization"] } };
    }
    if (
      project.hasLoggedTime &&
      (form.billing !== project.billing || form.currency !== project.currency)
    ) {
      return {
        formError: "Time is logged on this project. Start a new project to bill it differently.",
      };
    }
    const openToMembers = await database.$count(
      projectOrganizations,
      and(
        eq(projectOrganizations.projectId, project.id),
        eq(projectOrganizations.openToMembers, true),
      ),
    );
    if (form.billing !== "non_billable" && openToMembers) {
      return { formError: "Only non-billable projects can be open to an organization's members" };
    }
    try {
      await database.transaction(async (transaction) => {
        await transaction.update(projects).set(form).where(eq(projects.id, project.id));
        if (contractOwnerId === project.contractOwnerId) return;
        const previousOwnerId = project.contractOwnerId;
        // Cleared first: the unique index allows one contract owner per project.
        if (previousOwnerId !== null) {
          await transaction
            .update(projectOrganizations)
            .set({ isContractOwner: false })
            .where(participation(project.id, previousOwnerId));
        }
        if (contractOwnerId !== null) {
          await ensureParticipation(transaction, { projectId: project.id, orgId: contractOwnerId });
          await transaction
            .update(projectOrganizations)
            .set({ isContractOwner: true })
            .where(participation(project.id, contractOwnerId));
        }
        if (previousOwnerId !== null) {
          await removeUnneededParticipation(transaction, {
            projectId: project.id,
            orgId: previousOwnerId,
          });
        }
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
