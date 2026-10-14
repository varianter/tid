import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { lockMonth } from "./lockMonth.command";
import { monthDetails, monthDetailsRedirect } from "./monthDetails.query";
import { unlockMonth } from "./unlockMonth.command";

export const endOfTheMonth = new Hono<UserEnv>()
  .get("/", monthDetailsRedirect)
  .get("/:organization", monthDetailsRedirect)
  .get("/:organization/:month", monthDetails)
  .post("/:organization/:month/lock", lockMonth)
  .post("/:organization/:month/unlock", unlockMonth);
