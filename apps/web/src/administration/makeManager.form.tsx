import { Button } from "@tid/ui";
import { managerRolePath } from "./administration.url";

export function MakeManagerForm({ userId, name }: { userId: number; name: string }) {
  return (
    <form method="post" action={managerRolePath(userId)}>
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
