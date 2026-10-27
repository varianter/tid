import { Button } from "@tid/ui";
import { managersPath } from "./administration.url";

export function MakeManagerForm({
  organizationSlug,
  userId,
  name,
}: {
  organizationSlug: string;
  userId: number;
  name: string;
}) {
  return (
    <form method="post" action={`${managersPath(organizationSlug)}/${userId}`}>
      <Button
        type="submit"
        data-variant="plain"
        data-size="small"
        aria-label={`Make ${name} a manager`}
      >
        Make manager
      </Button>
    </form>
  );
}
