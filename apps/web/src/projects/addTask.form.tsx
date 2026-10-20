import { Button, Input } from "@tid/ui";

export function AddTaskForm({ projectId }: { projectId: number }) {
  return (
    <form method="post" action={`/projects/${projectId}/tasks`} class="stack-h items-center gap-xs">
      <Input name="name" aria-label="Task name" placeholder="Task name" required />
      <Button type="submit">Add task</Button>
    </form>
  );
}
