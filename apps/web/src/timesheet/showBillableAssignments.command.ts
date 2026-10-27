import { isIsoMonth } from "@tid/calendar/isoDate";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { UserEnv } from "../domain/users/user";
import { hideBillableAssignmentsCookie } from "./billableAssignments";

export const showBillableAssignments = async (
  c: Context<UserEnv, "/month/:month/billable-assignments">,
) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  const { show } = await c.req.parseBody();
  if (show === "on") deleteCookie(c, hideBillableAssignmentsCookie, { path: "/" });
  else
    setCookie(c, hideBillableAssignmentsCookie, "on", {
      path: "/",
      maxAge: 31536000,
      sameSite: "Lax",
      httpOnly: true,
    });
  return c.redirect(`/timesheet/month/${month}${new URL(c.req.url).search}`, 303);
};
