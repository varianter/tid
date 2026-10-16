import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { monthlyReport, monthlyReportRedirect } from "./monthlyReport.query";
import { projectTimesheet } from "./projectTimesheet.query";

export const reports = new Hono<UserEnv>()
  .get("/", monthlyReportRedirect)
  .get("/:organization", monthlyReport)
  .get("/:organization/projects/:code/:month", projectTimesheet);
