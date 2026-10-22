import { hasMonthStarted } from "@tid/calendar/osloClock";
import type { Context } from "hono";
import type { LockChangeEnv } from "./lockChange.middleware";
import { addLock } from "./monthLock.data";
import { monthUrl } from "./monthUrl";

export const lockMonth = async (c: Context<LockChangeEnv>) => {
  const organization = c.get("organization");
  const month = c.get("month");
  if (!hasMonthStarted(month)) return c.text("Months that haven't started can't be locked", 400);
  await addLock(organization.id, month, c.get("user").id);
  return c.redirect(monthUrl.path({ month, company: organization.slug }), 303);
};
