import { Button } from "@tid/ui";
import { managersPath } from "./administration.url";

export function RemoveManagerForm({
  organizationSlug,
  userId,
  name,
}: {
  organizationSlug: string;
  userId: number;
  name: string;
}) {
  return (
    <form method="post" action={`${managersPath(organizationSlug)}/${userId}/delete`}>
      <Button
        type="submit"
        data-variant="plain"
        data-size="small"
        aria-label={`Remove ${name} as manager`}
      >
        Remove manager
      </Button>
    </form>
  );
}
