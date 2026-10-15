import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { makeManager } from "./makeManager.command";
import { managersOnly } from "./manager";
import { removeManager } from "./removeManager.command";
import { userList } from "./userList.query";

export const users = new Hono<UserEnv>()
  .use(managersOnly)
  .get("/", userList)
  .post("/:userId/manager", makeManager)
  .post("/:userId/manager/delete", removeManager);
