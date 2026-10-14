import type { Context } from "hono";
import { isIsoMonth } from "../dates/isoDate";
import { todayInOslo } from "../dates/osloClock";
import type { UserEnv } from "../login/user";
import { monthPath, renderMonth } from "./monthPage";

export const timesheetMonthRedirect = (c: Context<UserEnv>) =>
  c.redirect(monthPath(todayInOslo().slice(0, 7), false));

export const timesheetMonth = async (c: Context<UserEnv, "/month/:month">) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  return renderMonth(c, month);
};
