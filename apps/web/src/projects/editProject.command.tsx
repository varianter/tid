import { clients, projects } from "@tid/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { billableCountsTowardBase, ProjectFormPage, projectFields } from "./projectForm";

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
        openToEveryone: projects.openToEveryone,
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(eq(projects.id, id));
    return project ? { project } : c.notFound();
  },
  onSubmit: async (_c, form, { project }) => {
    if (form.billable && project.openToEveryone) {
      return { formError: "Projects open to everyone can't be billable" };
    }
    try {
      await database.update(projects).set(form).where(eq(projects.id, project.id));
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
