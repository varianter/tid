import { FormField, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";

export const addTaskForm = z.object({ name: z.string().trim().min(1, "Enter a name") });

type AddTaskFormPageProps = {
  project: { id: number; name: string };
  form: FormState<typeof addTaskForm>;
};

export function AddTaskFormPage({ project, form }: AddTaskFormPageProps) {
  return (
    <FormPage
      title={`New task on ${project.name}`}
      cancel={`/projects/${project.id}`}
      submit="Add task"
      form={form}
      layer="tooltip"
    >
      <FormField
        name="name"
        label="Task name"
        value={form.values?.name}
        errors={form.fieldErrors.name}
        required
      />
    </FormPage>
  );
}
