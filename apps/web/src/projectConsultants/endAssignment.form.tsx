import { Form, FormField, FormPage } from "@tid/ui";
import { z } from "zod";
import { dayParam } from "../framework/calendarParams";
import type { FormState } from "../framework/formAction";
import type { ProjectConsultantIds } from "./projectConsultant";

// Removing someone without logged time takes no date.
export const endAssignmentForm = z.object({
  endsOn: dayParam("Choose a date").optional(),
});

type EndAssignmentFormPageProps = {
  ids: ProjectConsultantIds;
  name: string;
  hasLoggedTime: boolean;
  today: Temporal.PlainDate;
  form: FormState<typeof endAssignmentForm>;
};

export function EndAssignmentFormPage({
  ids,
  name,
  hasLoggedTime,
  today,
  form,
}: EndAssignmentFormPageProps) {
  return (
    <FormPage title={`End ${name}'s assignment`} layer="tooltip">
      <Form
        cancel={`/projects/${ids.projectId}`}
        submit={hasLoggedTime ? "End assignment" : "Remove from project"}
        state={form}
      >
        {hasLoggedTime ? (
          <FormField
            name="endsOn"
            label="Last day on the project"
            type="date"
            value={form.values?.endsOn ?? today.toString()}
            errors={form.fieldErrors.endsOn}
            required
          />
        ) : (
          <p>{name} has no hours logged and can be safely removed from the project.</p>
        )}
      </Form>
    </FormPage>
  );
}
