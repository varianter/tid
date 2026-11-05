import type { Context } from "hono";
import type { LockChangeEnv } from "./lockChange.middleware";
import { consultantHoursUrl } from "./monthClose.url";
import { liftLock } from "./monthLock.data";

export const unlockMonth = async (c: Context<LockChangeEnv>) => {
  const organization = c.get("organization");
  const month = c.get("month");
  await liftLock(organization.id, month, c.get("user").id);
  return c.redirect(consultantHoursUrl.path({ month, organization: organization.slug }), 303);
};
