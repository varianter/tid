import type { Context } from "hono";

export const usersPath = (organizationSlug: string) =>
  `/users?${new URLSearchParams({ organization: organizationSlug })}`;

export function userIdParam(c: Context) {
  const userId = Number(c.req.param("userId"));
  return Number.isSafeInteger(userId) ? userId : undefined;
}
