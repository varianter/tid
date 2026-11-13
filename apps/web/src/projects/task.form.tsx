import { Form, FormField, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";

export const taskFields = z.object({ name: z.string().trim().min(1, "Enter a name") });

export const alreadyExists = {
  fieldErrors: { name: ["The project already has a task with this name"] },
};

type TaskFormPageProps = {
  project: { id: number; name: string };
  task?: { name: string };
  form: FormState<typeof taskFields>;
};

/** Adds a task to `project`, or renames `task` when given. */
export function TaskFormPage({ project, task, form }: TaskFormPageProps) {
  return (
    <FormPage title={task ? `Rename ${task.name}` : `New task on ${project.name}`} layer="tooltip">
      <Form
        cancel={`/projects/${project.id}`}
        submit={task ? "Save changes" : "Add task"}
        state={form}
      >
        <FormField
          name="name"
          label="Task name"
          value={form.values?.name ?? task?.name}
          errors={form.fieldErrors.name}
          required
        />
      </Form>
    </FormPage>
  );
}
