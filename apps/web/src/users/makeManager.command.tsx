import { userRoles } from "@tid/db/schema";
import { Button } from "@tid/ui";
import type { Context } from "hono";
import { database } from "../database";
import { userIdParam, usersPath } from "./usersUrl";

export const makeManager = async (c: Context) => {
  const userId = userIdParam(c);
  if (userId === undefined) return c.notFound();
  await database.insert(userRoles).values({ userId, role: "manager" }).onConflictDoNothing();
  return c.redirect(usersPath(c.req.query("organization") ?? ""), 303);
};

export function MakeManagerForm({
  userId,
  organizationSlug,
}: {
  userId: number;
  organizationSlug: string;
}) {
  return (
    <form method="post" action={`/users/${userId}/manager?organization=${organizationSlug}`}>
      <Button type="submit" data-variant="plain" data-size="small">
        Make manager
      </Button>
    </form>
  );
}
