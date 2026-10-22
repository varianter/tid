import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly } from "../managers/manager";
import { applesauce as applesaucePage } from "./applesauce.query";

// Spans every office, so it's for managers, who may see every country.
export const applesauce = new Hono<UserEnv>().use(managersOnly).get("/", applesaucePage);
