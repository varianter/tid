import { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { monthFromParam } from "../framework/calendarParams";
import { logHours, logHoursInPlace } from "./logHours.command";
import { showBillableAssignments } from "./showBillableAssignments.command";
import { timesheetMonth, timesheetMonthRedirect } from "./timesheetMonth.query";

export const timesheet = new Hono<UserEnv>()
  .get("/", timesheetMonthRedirect)
  .get("/month/:month", monthFromParam, timesheetMonth)
  .post("/month/:month/cells", monthFromParam, logHours)
  .post("/month/:month/cell", monthFromParam, logHoursInPlace)
  .post("/month/:month/billable-assignments", monthFromParam, showBillableAssignments);
