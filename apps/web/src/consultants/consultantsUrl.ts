import type { Context } from "hono";

export const consultantsPath = (company: string) =>
  `/consultants?${new URLSearchParams({ company })}`;

export const consultantPath = (userId: number, month?: string) =>
  month ? `/consultants/${userId}?${new URLSearchParams({ month })}` : `/consultants/${userId}`;

export function userIdParam(c: Context) {
  const userId = Number(c.req.param("userId"));
  return Number.isSafeInteger(userId) ? userId : undefined;
}
