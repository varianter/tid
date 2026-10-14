import { Button } from "@tid/ui";
import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { readLockChange } from "./lockChange";
import { liftLock } from "./monthLock";
import { monthPath } from "./monthUrl";

export const unlockMonth = async (c: Context<UserEnv>) => {
  const change = await readLockChange(c);
  if (change instanceof Response) return change;
  const { organization, month } = change;
  await liftLock(organization.id, month, c.get("user").id);
  return c.redirect(monthPath(organization.slug, month), 303);
};

export function UnlockMonthForm({
  organizationSlug,
  month,
}: {
  organizationSlug: string;
  month: string;
}) {
  return (
    <form method="post" action={`${monthPath(organizationSlug, month)}/unlock`} class="ml-auto">
      <Button type="submit">Unlock this month</Button>
    </form>
  );
}
