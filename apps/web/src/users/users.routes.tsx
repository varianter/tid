import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { makeManager } from "./makeManager.command";
import { managersOnly } from "./manager";
import { removeManager } from "./removeManager.command";
import { userDetails } from "./userDetails.query";
import { userList } from "./userList.query";

export const users = new Hono<UserEnv>()
  .get("/", managersOnly, userList)
  .get("/:userId", userDetails)
  .post("/:userId/manager", managersOnly, makeManager)
  .post("/:userId/manager/delete", managersOnly, removeManager);
