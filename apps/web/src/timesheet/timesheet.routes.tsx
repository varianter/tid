import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { logHours, logHoursInPlace } from "./logHours.command";
import { timesheetMonth, timesheetMonthRedirect } from "./timesheetMonth.query";

export const timesheet = new Hono<UserEnv>()
  .get("/", timesheetMonthRedirect)
  .get("/month/:month", timesheetMonth)
  .post("/month/:month/cells", logHours)
  .post("/month/:month/cell", logHoursInPlace);
