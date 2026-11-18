import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { UserEnv } from "../domain/users/user";
import type { MonthParamEnv } from "../framework/calendarParams";
import { hideBillableAssignmentsCookie } from "./billableAssignments";

export const showBillableAssignments = async (c: Context<UserEnv & MonthParamEnv>) => {
  const month = c.get("month");
  const { hide } = await c.req.parseBody();
  if (hide === "on")
    setCookie(c, hideBillableAssignmentsCookie, "on", {
      path: "/",
      maxAge: 31536000,
      sameSite: "Lax",
      httpOnly: true,
    });
  else deleteCookie(c, hideBillableAssignmentsCookie, { path: "/" });
  return c.redirect(`/timesheet/month/${month}${new URL(c.req.url).search}`, 303);
};
