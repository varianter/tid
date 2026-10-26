import { isIsoDate } from "@tid/calendar/isoDate";
import { FormField } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";
import type { ProjectConsultantIds } from "./projectConsultant";

// Removing someone without logged time takes no date.
export const endAssignmentForm = z.object({
  endsOn: z.string().refine(isIsoDate, "Choose a date").optional(),
});

type EndAssignmentProps = {
  ids: ProjectConsultantIds;
  name: string;
  hasLoggedTime: boolean;
  today: string;
};

export const endAssignmentFrame = ({ ids, name, hasLoggedTime }: EndAssignmentProps) => ({
  title: `End ${name}'s assignment`,
  cancel: `/projects/${ids.projectId}`,
  submit: hasLoggedTime ? "End assignment" : "Remove from project",
});

export function EndAssignmentFields({
  name,
  hasLoggedTime,
  today,
  values,
  fieldErrors,
}: EndAssignmentProps & FormProps) {
  return hasLoggedTime ? (
    <FormField
      name="endsOn"
      label="Last day on the project"
      type="date"
      value={values?.endsOn ?? today}
      errors={fieldErrors?.endsOn}
      required
    />
  ) : (
    <p>{name} has no hours logged and can be safely removed from the project.</p>
  );
}
