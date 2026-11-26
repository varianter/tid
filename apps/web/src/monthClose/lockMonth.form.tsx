import { formatMonth } from "@tid/calendar/dateDisplay";
import { hasMonthStarted } from "@tid/calendar/osloClock";
import { Button, Icon } from "@tid/ui";
import { monthLockPath } from "./monthClose.url";

/** Future months can be unlocked but not locked, so they get no form. */
export function LockMonthForm({
  organizationSlug,
  month,
}: {
  organizationSlug: string;
  month: Temporal.PlainYearMonth;
}) {
  if (!hasMonthStarted(month)) return null;
  return (
    <form method="post" action={monthLockPath(organizationSlug, month, "lock")} class="ml-auto">
      <Button type="submit">
        <Icon name="lock" />
        Lock {formatMonth(month, "monthName")}
      </Button>
    </form>
  );
}
