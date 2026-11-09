import { Hono } from "hono";
import { managersOnly } from "../domain/managers/manager.middleware";
import type { UserEnv } from "../domain/users/user";
import { chooseOpenProjects } from "./chooseOpenProjects.command";
import { makeManager } from "./makeManager.command";
import { managerList } from "./managerList.query";
import { organizationOverview } from "./organizationOverview.query";
import { removeManager } from "./removeManager.command";

export const administration = new Hono<UserEnv>()
  .use(managersOnly)
  .get("/", organizationOverview)
  .on(["GET", "POST"], "/projects", chooseOpenProjects)
  .get("/managers", managerList)
  .post("/managers/:userId", makeManager)
  .post("/managers/:userId/delete", removeManager);
