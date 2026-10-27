import { formatDate } from "@tid/calendar/dateDisplay";
import { Button, Icon } from "@tid/ui";
import { monthLockPath } from "./monthClose.url";

export function UnlockMonthForm({
  organizationSlug,
  month,
}: {
  organizationSlug: string;
  month: string;
}) {
  return (
    <form method="post" action={monthLockPath(organizationSlug, month, "unlock")} class="ml-auto">
      <Button type="submit">
        <Icon name="lock_open" />
        Unlock {formatDate(month, "monthName")}
      </Button>
    </form>
  );
}
