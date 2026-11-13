import { projects, tasks } from "@tid/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { alreadyExists, TaskFormPage, taskFields } from "./task.form";

// Reports, exports and invoice data read the task's current name, so a rename reaches locked
// months too. The hours and their rates stay as they were.
export const renameTask = formAction({
  schema: taskFields,
  loader: async (c) => {
    const projectId = Number(c.req.param("id"));
    const taskId = Number(c.req.param("taskId"));
    if (!Number.isSafeInteger(projectId) || !Number.isSafeInteger(taskId)) return c.notFound();
    const [row] = await database
      .select({
        project: { id: projects.id, name: projects.name },
        task: { id: tasks.id, name: tasks.name },
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));
    return row ?? c.notFound();
  },
  onSubmit: async (_c, { name }, { project, task }) => {
    const nameTaken = await database.$count(
      tasks,
      and(eq(tasks.projectId, project.id), eq(tasks.name, name), ne(tasks.id, task.id)),
    );
    if (nameTaken) return alreadyExists;
    await database.update(tasks).set({ name }).where(eq(tasks.id, task.id));
    return { redirect: `/projects/${project.id}` };
  },
  view: TaskFormPage,
});
