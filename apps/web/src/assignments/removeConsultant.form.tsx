import { Button } from "@tid/ui";

export function RemoveConsultantForm({
  projectId,
  userId,
  name,
}: {
  projectId: number;
  userId: number;
  name: string;
}) {
  return (
    <form method="post" action={`/projects/${projectId}/assignments/${userId}/delete`}>
      <Button
        type="submit"
        data-variant="plain"
        data-size="small"
        aria-label={`Remove ${name} from the project`}
      >
        Remove
      </Button>
    </form>
  );
}
