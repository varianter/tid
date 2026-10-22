import { Button } from "@tid/ui";
import { monthLockPath } from "./monthUrl";

export function UnlockMonthForm({
  organizationSlug,
  month,
}: {
  organizationSlug: string;
  month: string;
}) {
  return (
    <form method="post" action={monthLockPath(organizationSlug, month, "unlock")} class="ml-auto">
      <Button type="submit">Unlock this month</Button>
    </form>
  );
}
