import { Hono } from "hono";
import { managersOnly } from "../domain/managers/manager.middleware";
import type { UserEnv } from "../domain/users/user";
import { consultantDetails } from "./consultantDetails.query";
import { consultantList } from "./consultantList.query";

export const consultants = new Hono<UserEnv>()
  .get("/", managersOnly, consultantList)
  .get("/:userId", consultantDetails);
