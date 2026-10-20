import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { monthlyReport } from "./monthlyReport.query";

export const reports = new Hono<UserEnv>().get("/", monthlyReport);
