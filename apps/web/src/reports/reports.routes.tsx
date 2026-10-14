import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { monthlyReport, monthlyReportRedirect } from "./monthlyReport.query";

export const reports = new Hono<UserEnv>()
  .get("/", monthlyReportRedirect)
  .get("/:organization", monthlyReport);
