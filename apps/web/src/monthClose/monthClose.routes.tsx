import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { lockChangeManagersOnly } from "./lockChange.middleware";
import { lockMonth } from "./lockMonth.command";
import { monthDetails, monthDetailsRedirect } from "./monthDetails.query";
import { unlockMonth } from "./unlockMonth.command";

export const monthClose = new Hono<UserEnv>()
  .get("/", monthDetailsRedirect)
  .get("/:month", monthDetails)
  .post("/:organization/:month/lock", lockChangeManagersOnly, lockMonth)
  .post("/:organization/:month/unlock", lockChangeManagersOnly, unlockMonth);
