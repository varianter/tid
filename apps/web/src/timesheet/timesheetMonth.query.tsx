import { isIsoMonth } from "@tid/calendar/isoDate";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { renderMonth } from "./monthPage";
import { monthPath } from "./timesheetUrl";

export const timesheetMonthRedirect = (c: Context<UserEnv>) =>
  c.redirect(monthPath(thisMonthInOslo(), false));

export const timesheetMonth = async (c: Context<UserEnv, "/month/:month">) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  return renderMonth(c, month);
};
