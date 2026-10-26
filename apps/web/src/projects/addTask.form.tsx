import { Button, FormField, Page } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";

export const addTaskForm = z.object({ name: z.string().trim().min(1, "Enter a name") });

type AddTaskPageProps = { project: { id: number; name: string } } & FormProps;

export function AddTaskPage({ project, values, fieldErrors }: AddTaskPageProps) {
  return (
    <Page
      title={`New task on ${project.name}`}
      back={{ href: `/projects/${project.id}`, label: `Back to ${project.name}` }}
    >
      <form method="post" class="stack-v items-start gap-m">
        <FormField
          name="name"
          label="Task name"
          value={values?.name}
          errors={fieldErrors?.name}
          required
        />
        <Button type="submit">Add task</Button>
      </form>
    </Page>
  );
}
