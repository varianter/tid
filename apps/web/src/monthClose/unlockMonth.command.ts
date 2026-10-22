import type { Context } from "hono";
import type { LockChangeEnv } from "./lockChange.middleware";
import { liftLock } from "./monthLock.data";
import { monthUrl } from "./monthUrl";

export const unlockMonth = async (c: Context<LockChangeEnv>) => {
  const organization = c.get("organization");
  const month = c.get("month");
  await liftLock(organization.id, month, c.get("user").id);
  return c.redirect(monthUrl.path({ month, company: organization.slug }), 303);
};
