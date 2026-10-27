import { Hono } from "hono";
import { managersOnly } from "../domain/managers/manager.middleware";
import type { UserEnv } from "../domain/users/user";
import { officeSummary as officeSummaryPage } from "./officeSummary.query";

// Spans every office, so it's for managers, who may see every country.
export const officeSummary = new Hono<UserEnv>().use(managersOnly).get("/", officeSummaryPage);
