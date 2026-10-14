import { projects, tasks } from "@tid/db/schema";
import { Button, Input } from "@tid/ui";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";

export const addTask = async (c: Context) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id) || !(await database.$count(projects, eq(projects.id, id)))) {
    return c.notFound();
  }
  const name = String((await c.req.parseBody()).name ?? "").trim();
  // A task that already has the name is what the user asked for, so a clash needs no error.
  if (name) await database.insert(tasks).values({ projectId: id, name }).onConflictDoNothing();
  return c.redirect(`/projects/${id}`, 303);
};

export function AddTaskForm({ projectId }: { projectId: number }) {
  return (
    <form method="post" action={`/projects/${projectId}/tasks`} class="stack-h items-center gap-xs">
      <Input name="name" aria-label="Task name" placeholder="Task name" required />
      <Button type="submit">Add task</Button>
    </form>
  );
}
