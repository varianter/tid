import { isIsoMonth } from "@tid/calendar/isoDate";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { MonthPage } from "./monthPage";
import { loadTimesheet } from "./timesheet.data";
import { monthPath } from "./timesheet.url";

export const timesheetMonthRedirect = (c: Context<UserEnv>) =>
  c.redirect(monthPath(thisMonthInOslo(), false));

export const timesheetMonth = async (c: Context<UserEnv, "/month/:month">) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  const user = c.get("user");
  return c.render(
    <MonthPage
      month={month}
      user={user}
      search={new URL(c.req.url).search}
      timesheet={await loadTimesheet(user, month)}
    />,
  );
};
