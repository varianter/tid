import { hasMonthStarted } from "@tid/calendar/osloClock";
import type { Context } from "hono";
import type { LockChangeEnv } from "./lockChange.middleware";
import { monthUrl } from "./monthClose.url";
import { addLock } from "./monthLock.data";

export const lockMonth = async (c: Context<LockChangeEnv>) => {
  const organization = c.get("organization");
  const month = c.get("month");
  if (!hasMonthStarted(month)) return c.text("Months that haven't started can't be locked", 400);
  await addLock(organization.id, month, c.get("user").id);
  return c.redirect(monthUrl.path({ month, organization: organization.slug }), 303);
};
