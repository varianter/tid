import { thisMonthInOslo } from "@tid/calendar/osloClock";
import type { Context } from "hono";
import { z } from "zod";
import { monthField } from "../query/pageMonth";
import { idParam, pageUrl } from "../query/pageUrl";

export const consultantsPath = (company: string) =>
  `/consultants?${new URLSearchParams({ company })}`;

export const consultantUrl = pageUrl(
  "/consultants/:userId",
  z.object({ userId: idParam, ...monthField }),
);

export const consultantPath = (userId: number, month = thisMonthInOslo()) =>
  consultantUrl.path({ userId, month });

export function userIdParam(c: Context) {
  const userId = Number(c.req.param("userId"));
  return Number.isSafeInteger(userId) ? userId : undefined;
}
