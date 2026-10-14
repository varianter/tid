import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { makeManager } from "./makeManager.command";
import { isManager } from "./manager";
import { removeManager } from "./removeManager.command";
import { userList } from "./userList.query";

export const users = new Hono<UserEnv>()
  .use(async (c, next) => {
    if (!(await isManager(c.get("user")))) return c.text("Only managers can manage users", 403);
    await next();
  })
  .get("/", userList)
  .post("/:userId/manager", makeManager)
  .post("/:userId/manager/delete", removeManager);
