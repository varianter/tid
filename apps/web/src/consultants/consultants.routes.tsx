import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly } from "../managers/manager";
import { consultantDetails } from "./consultantDetails.query";
import { consultantList } from "./consultantList.query";

export const consultants = new Hono<UserEnv>()
  .get("/", managersOnly, consultantList)
  .get("/:userId", consultantDetails);
