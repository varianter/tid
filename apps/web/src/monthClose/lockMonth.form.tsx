import { formatDate } from "@tid/calendar/dateDisplay";
import { hasMonthStarted } from "@tid/calendar/osloClock";
import { Button, Icon } from "@tid/ui";
import { monthLockPath } from "./monthUrl";

/** Future months can be unlocked but not locked, so they get no form. */
export function LockMonthForm({
  organizationSlug,
  month,
}: {
  organizationSlug: string;
  month: string;
}) {
  if (!hasMonthStarted(month)) return null;
  return (
    <form method="post" action={monthLockPath(organizationSlug, month, "lock")} class="ml-auto">
      <Button type="submit">
        <Icon name="lock" />
        Lock {formatDate(month, "monthName")}
      </Button>
    </form>
  );
}
