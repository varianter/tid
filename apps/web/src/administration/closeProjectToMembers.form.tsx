import { Button } from "@tid/ui";
import { openProjectsPath } from "./administrationUrl";

export function CloseProjectToMembersForm({
  organizationSlug,
  projectId,
  name,
}: {
  organizationSlug: string;
  projectId: number;
  name: string;
}) {
  return (
    <form method="post" action={`${openProjectsPath(organizationSlug)}/${projectId}/delete`}>
      <Button
        type="submit"
        data-variant="plain"
        data-size="small"
        aria-label={`Close ${name} to everyone`}
      >
        Close to everyone
      </Button>
    </form>
  );
}
