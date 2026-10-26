import { FormField } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";

export const addTaskForm = z.object({ name: z.string().trim().min(1, "Enter a name") });

type AddTaskProps = { project: { id: number; name: string } };

export const addTaskFrame = ({ project }: AddTaskProps) => ({
  title: `New task on ${project.name}`,
  cancel: `/projects/${project.id}`,
  submit: "Add task",
});

export function AddTaskFields({ values, fieldErrors }: AddTaskProps & FormProps) {
  return (
    <FormField
      name="name"
      label="Task name"
      value={values?.name}
      errors={fieldErrors?.name}
      required
    />
  );
}
