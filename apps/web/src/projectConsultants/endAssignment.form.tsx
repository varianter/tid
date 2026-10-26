import { isIsoDate } from "@tid/calendar/isoDate";
import { Button, FormField, Page } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";
import type { ProjectConsultantIds } from "./projectConsultant";

// Removing someone without logged time takes no date.
export const endAssignmentForm = z.object({
  endsOn: z.string().refine(isIsoDate, "Choose a date").optional(),
});

type EndAssignmentPageProps = {
  ids: ProjectConsultantIds;
  name: string;
  projectName: string;
  hasLoggedTime: boolean;
  today: string;
} & FormProps;

export function EndAssignmentPage({
  ids,
  name,
  projectName,
  hasLoggedTime,
  today,
  values,
  fieldErrors,
}: EndAssignmentPageProps) {
  return (
    <Page
      title={`End ${name}'s assignment`}
      back={{ href: `/projects/${ids.projectId}`, label: `Back to ${projectName}` }}
    >
      <form method="post" class="stack-v items-start gap-m">
        {hasLoggedTime ? (
          <>
            <FormField
              name="endsOn"
              label="Last day on the project"
              type="date"
              value={values?.endsOn ?? today}
              errors={fieldErrors?.endsOn}
              required
            />
            <Button type="submit">End assignment</Button>
          </>
        ) : (
          <>
            <p>{name} has no hours logged and can be safely removed from the project.</p>
            <Button type="submit">Remove from project</Button>
          </>
        )}
      </form>
    </Page>
  );
}
