import { projects, tasks } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { AddTaskFields, addTaskForm, addTaskFrame } from "./addTask.form";

export const addTask = formAction({
  schema: addTaskForm,
  loader: async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isSafeInteger(id)) return c.notFound();
    const [project] = await database
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, id));
    return project ? { project } : c.notFound();
  },
  onSubmit: async (_c, { name }, { project }) => {
    // A task that already has the name is what the user asked for, so a clash needs no error.
    await database.insert(tasks).values({ projectId: project.id, name }).onConflictDoNothing();
    return { redirect: `/projects/${project.id}` };
  },
  frame: addTaskFrame,
  view: AddTaskFields,
});
