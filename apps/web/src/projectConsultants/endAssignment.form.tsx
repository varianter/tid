import { isIsoDate } from "@tid/calendar/isoDate";
import { FormField, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";
import type { ProjectConsultantIds } from "./projectConsultant";

// Removing someone without logged time takes no date.
export const endAssignmentForm = z.object({
  endsOn: z.string().refine(isIsoDate, "Choose a date").optional(),
});

type EndAssignmentFormPageProps = {
  ids: ProjectConsultantIds;
  name: string;
  hasLoggedTime: boolean;
  today: string;
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
    <FormPage
      title={`End ${name}'s assignment`}
      cancel={`/projects/${ids.projectId}`}
      submit={hasLoggedTime ? "End assignment" : "Remove from project"}
      form={form}
      layer="tooltip"
    >
      {hasLoggedTime ? (
        <FormField
          name="endsOn"
          label="Last day on the project"
          type="date"
          value={form.values?.endsOn ?? today}
          errors={form.fieldErrors.endsOn}
          required
        />
      ) : (
        <p>{name} has no hours logged and can be safely removed from the project.</p>
      )}
    </FormPage>
  );
}
