import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { Button } from "@tid/ui";
import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { readLockChange } from "./lockChange";
import { addLock } from "./monthLock";
import { monthUrl } from "./monthUrl";

// A future month's hours aren't due yet.
const hasStarted = (month: string) => month <= thisMonthInOslo();

export const lockMonth = async (c: Context<UserEnv>) => {
  const change = await readLockChange(c);
  if (change instanceof Response) return change;
  const { organization, month } = change;
  if (!hasStarted(month)) return c.text("Months that haven't started can't be locked", 400);
  await addLock(organization.id, month, c.get("user").id);
  return c.redirect(monthUrl.path({ organization: organization.slug, month }), 303);
};

/** Future months can be unlocked but not locked, so they get no form. */
export function LockMonthForm({
  organizationSlug,
  month,
}: {
  organizationSlug: string;
  month: string;
}) {
  if (!hasStarted(month)) return null;
  return (
    <form
      method="post"
      action={`${monthUrl.path({ organization: organizationSlug, month })}/lock`}
      class="ml-auto"
    >
      <Button type="submit" data-variant="tinted">
        Lock this month
      </Button>
    </form>
  );
}
