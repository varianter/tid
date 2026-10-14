import { userRoles } from "@tid/db/schema";
import { Button } from "@tid/ui";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { userIdParam, usersPath } from "./usersUrl";

// Nothing stops the last manager removing themselves; the role is then restored in the database.
export const removeManager = async (c: Context) => {
  const userId = userIdParam(c);
  if (userId === undefined) return c.notFound();
  await database
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "manager")));
  return c.redirect(usersPath(c.req.query("organization") ?? ""), 303);
};

export function RemoveManagerForm({
  userId,
  organizationSlug,
}: {
  userId: number;
  organizationSlug: string;
}) {
  return (
    <form method="post" action={`/users/${userId}/manager/delete?organization=${organizationSlug}`}>
      <Button type="submit" data-variant="plain" data-size="small">
        Remove manager
      </Button>
    </form>
  );
}
