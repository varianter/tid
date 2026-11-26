import {
  assignmentRates,
  clients,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
} from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { DeleteProjectFormPage, deleteProjectForm } from "./deleteProject.form";
import { hasLoggedTime } from "./loggedTime.data";

// Only a project without logged time can go, such as one started by mistake. Once hours are
// logged, they're the record of the work.
export const deleteProject = formAction({
  schema: deleteProjectForm,
  loader: async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isSafeInteger(id)) return c.notFound();
    const [project] = await database
      .select({
        id: projects.id,
        name: projects.name,
        client: clients.name,
        hasLoggedTime: hasLoggedTime(projects.id),
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(eq(projects.id, id));
    if (!project) return c.notFound();
    if (project.hasLoggedTime)
      throw new HTTPException(403, { message: "A project with logged hours can't be deleted" });
    return { project };
  },
  onSubmit: async (_c, _form, { project }) => {
    try {
      await database.transaction(async (transaction) => {
        await transaction.delete(assignmentRates).where(eq(assignmentRates.projectId, project.id));
        await transaction
          .delete(projectAssignments)
          .where(eq(projectAssignments.projectId, project.id));
        // Time entries reference their task, so hours logged since the check stop the delete.
        await transaction.delete(tasks).where(eq(tasks.projectId, project.id));
        await transaction
          .delete(projectOrganizations)
          .where(eq(projectOrganizations.projectId, project.id));
        await transaction.delete(projects).where(eq(projects.id, project.id));
      });
    } catch (error) {
      const [since] = await database
        .select({ hasLoggedTime: hasLoggedTime(project.id) })
        .from(projects)
        .where(eq(projects.id, project.id));
      if (!since?.hasLoggedTime) throw error;
      return { formError: "Hours were just logged on this project, so it can't be deleted" };
    }
    return { redirect: "/projects" };
  },
  view: DeleteProjectFormPage,
});
