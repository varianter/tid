import { clients, projectOrganizations, projects, tasks, timeEntries } from "@tid/db/schema";
import { and, eq, exists, ne } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import type { User } from "../login/user";
import { findOrganizationCurrency } from "../organizations/organization";
import { listOrganizations } from "../organizations/organizationSelect";
import {
  editProjectForm,
  ProjectFields,
  parseBilling,
  projectColumns,
  projectFrame,
} from "./project.form";
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
    // Changing billing shows that billing's form, until time is logged.
    const billing = parseBilling(c.req.query("billing")) ?? project.billing;
    if (billing !== project.billing && project.hasLoggedTime) {
      return c.redirect(`/projects/${project.id}/edit`);
    }
    const user: User = c.get("user");
    // A project becoming billable likely bills in its contract owner's currency.
    const defaultCurrency = await findOrganizationCurrency(project.contractOwnerId ?? user.orgId);
    return {
      billing,
      project,
      organizations: await listOrganizations(),
      currencies: await listProjectCurrencies(),
      currency: project.currency ?? defaultCurrency ?? "",
      contractOwnerId: project.contractOwnerId,
    };
  },
  onSubmit: async (_c, form, { billing, project, organizations, currencies }) => {
    if (form.billing !== billing)
      return { formError: "The billing doesn't match. Go back and choose it again." };
    const contractOwnerId = form.contractOwnerId ?? null;
    const columns = projectColumns(form);
    if (columns.currency !== null && !currencies.includes(columns.currency)) {
      return { fieldErrors: { currency: ["Choose the currency agreed with the client"] } };
    }
    if (
      contractOwnerId !== null &&
      !organizations.some((organization) => organization.id === contractOwnerId)
    ) {
      return {
        fieldErrors: { contractOwnerId: ["Choose the organization that invoices the client"] },
      };
    }
    if (
      project.hasLoggedTime &&
      (columns.billing !== project.billing || columns.currency !== project.currency)
    ) {
      return {
        formError: "Hours are logged on this project. Start a new project to bill it differently.",
      };
    }
    const openToMembers = await database.$count(
      projectOrganizations,
      and(
        eq(projectOrganizations.projectId, project.id),
        eq(projectOrganizations.openToMembers, true),
      ),
    );
    if (columns.billing !== "non_billable" && openToMembers) {
      return { formError: "Only non-billable projects can be open to everyone" };
    }
    try {
      await database.transaction(async (transaction) => {
        await transaction.update(projects).set(columns).where(eq(projects.id, project.id));
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
        and(eq(projects.code, columns.code), ne(projects.id, project.id)),
      );
      return codeTaken
        ? { fieldErrors: { code: ["Another project uses this code"] } }
        : { fieldErrors: { name: ["The client already has a project with this name"] } };
    }
    return { redirect: `/projects/${project.id}` };
  },
  frame: projectFrame,
  view: ProjectFields,
});
