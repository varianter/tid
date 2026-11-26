import { Form, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";

// Confirming takes no fields; the project comes from the URL.
export const deleteProjectForm = z.object({});

type DeleteProjectFormPageProps = {
  project: { id: number; name: string; client: string };
  form: FormState<typeof deleteProjectForm>;
};

export function DeleteProjectFormPage({ project, form }: DeleteProjectFormPageProps) {
  return (
    <FormPage title={`Delete ${project.name}`} layer="tooltip" width={5}>
      <Form state={form} submit="Delete project" cancel={`/projects/${project.id}`}>
        <p>
          No hours are logged on {project.name} for {project.client}. Deleting it removes its tasks,
          consultants and rates too.
        </p>
      </Form>
    </FormPage>
  );
}
