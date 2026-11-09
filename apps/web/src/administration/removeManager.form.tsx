import { Button } from "@tid/ui";
import { managerRolePath } from "./administration.url";

export function RemoveManagerForm({ userId, name }: { userId: number; name: string }) {
  return (
    <form method="post" action={`${managerRolePath(userId)}/delete`}>
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
