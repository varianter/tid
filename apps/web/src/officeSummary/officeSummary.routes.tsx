import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly } from "../managers/manager.middleware";
import { officeSummary as officeSummaryPage } from "./officeSummary.query";

// Spans every office, so it's for managers, who may see every country.
export const officeSummary = new Hono<UserEnv>().use(managersOnly).get("/", officeSummaryPage);
