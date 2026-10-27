import { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { logHours, logHoursInPlace } from "./logHours.command";
import { showBillableAssignments } from "./showBillableAssignments.command";
import { timesheetMonth, timesheetMonthRedirect } from "./timesheetMonth.query";

export const timesheet = new Hono<UserEnv>()
  .get("/", timesheetMonthRedirect)
  .get("/month/:month", timesheetMonth)
  .post("/month/:month/cells", logHours)
  .post("/month/:month/cell", logHoursInPlace)
  .post("/month/:month/billable-assignments", showBillableAssignments);
