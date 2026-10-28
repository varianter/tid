import { clients, projectOrganizations, projects, tasks } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { listOrganizations } from "../domain/organizations/organization.data";
import type { User } from "../domain/users/user";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { ProjectFormPage, parseBilling, projectColumns, startProjectForm } from "./project.form";
import { suggestProjectCode } from "./projectCode";
import { listProjectCurrencies } from "./projectCurrency.data";

export const startProject = formAction({
  schema: startProjectForm,
  loader: async (c) => {
    const billing = parseBilling(c.req.param("billing"));
    if (!billing) return c.notFound();
    const user: User = c.get("user");
    const codes = await database
      .select({ clientId: projects.clientId, code: projects.code })
      .from(projects);
    const allCodes = codes.map((row) => row.code);
    const clientRows = await database.select().from(clients).orderBy(clients.name);
    return {
      billing,
      clients: clientRows.map((client) => ({
        ...client,
        codeSuggestion: suggestProjectCode(
          client.name,
          codes.filter((row) => row.clientId === client.id).map((row) => row.code),
          allCodes,
        ),
      })),
      suggestedClientId: c.req.query("client"),
      organizations: await listOrganizations(),
      currencies: await listProjectCurrencies(),
      // The user's organization is the suggested contract owner, so its currency is the likely one.
      currency: user.organization.currency,
      // Non-billable projects usually have no one invoicing them.
      contractOwnerId: billing === "non_billable" ? null : user.orgId,
    };
  },
  onSubmit: async (_c, form, { billing, clients, organizations, currencies }) => {
    if (form.billing !== billing)
      return { formError: "The billing doesn't match. Go back and choose it again." };
    const { contractOwnerId } = form;
    const project = { ...projectColumns(form), clientId: form.clientId };
    if (project.currency !== null && !currencies.includes(project.currency)) {
      return { fieldErrors: { currency: ["Choose the currency agreed with the client"] } };
    }
    if (!clients.some((client) => client.id === project.clientId)) {
      return { fieldErrors: { clientId: ["Choose a client"] } };
    }
    if (
      contractOwnerId !== undefined &&
      !organizations.some((organization) => organization.id === contractOwnerId)
    ) {
      return {
        fieldErrors: { contractOwnerId: ["Choose the organization that invoices the client"] },
      };
    }
    const [inserted] = await database.transaction(async (transaction) => {
      const rows = await transaction
        .insert(projects)
        .values(project)
        .onConflictDoNothing()
        .returning();
      if (!rows[0]) return rows;
      const projectId = rows[0].id;
      await transaction.insert(tasks).values({ projectId, name: form.firstTask });
      // Without a contract owner, the project joins organizations as people are assigned to it.
      if (contractOwnerId !== undefined) {
        await transaction
          .insert(projectOrganizations)
          .values({ projectId, orgId: contractOwnerId, isContractOwner: true });
      }
      return rows;
    });
    if (inserted) return { redirect: `/projects/${inserted.id}` };

    const codeTaken = await database.$count(projects, eq(projects.code, project.code));
    return codeTaken
      ? { fieldErrors: { code: ["Another project uses this code"] } }
      : { fieldErrors: { name: ["The client already has a project with this name"] } };
  },
  view: ProjectFormPage,
});
