import { clients, projectOrganizations, projects } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "../database";
import { formAction } from "../form/formAction";
import type { User } from "../login/user";
import { suggestProjectCode } from "./projectCode";
import { billableCountsTowardBase, ProjectFormPage, projectFields } from "./projectForm";

const startProjectForm = billableCountsTowardBase(
  projectFields.extend({ clientId: z.coerce.number().int() }),
);

export const startProject = formAction({
  schema: startProjectForm,
  loader: async (c) => {
    const codes = await database
      .select({ clientId: projects.clientId, code: projects.code })
      .from(projects);
    const allCodes = codes.map((row) => row.code);
    const clientRows = await database.select().from(clients).orderBy(clients.name);
    return {
      clients: clientRows.map((client) => ({
        ...client,
        codeSuggestion: suggestProjectCode(
          client.name,
          codes.filter((row) => row.clientId === client.id).map((row) => row.code),
          allCodes,
        ),
      })),
      suggestedClientId: c.req.query("client"),
    };
  },
  onSubmit: async (c, project, { clients }) => {
    if (!clients.some((client) => client.id === project.clientId)) {
      return { fieldErrors: { clientId: ["Pick a client"] } };
    }
    const user: User = c.get("user");
    const [inserted] = await database.transaction(async (transaction) => {
      const rows = await transaction
        .insert(projects)
        .values(project)
        .onConflictDoNothing()
        .returning();
      if (rows[0]) {
        await transaction
          .insert(projectOrganizations)
          .values({ projectId: rows[0].id, orgId: user.orgId, isOwner: true });
      }
      return rows;
    });
    if (inserted) return { redirect: `/projects/${inserted.id}` };

    const codeTaken = await database.$count(projects, eq(projects.code, project.code));
    return codeTaken
      ? { fieldErrors: { code: ["Already in use"] } }
      : { fieldErrors: { name: ["The client already has a project with this name"] } };
  },
  view: ProjectFormPage,
});
