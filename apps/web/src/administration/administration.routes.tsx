import { Hono } from "hono";
import { managersOnly } from "../domain/managers/manager.middleware";
import type { UserEnv } from "../domain/users/user";
import { makeManager } from "./makeManager.command";
import { managerList } from "./managerList.query";
import { chooseOpenProjects } from "./openProjects.command";
import { organizationOverview, organizationOverviewRedirect } from "./organizationOverview.query";
import { removeManager } from "./removeManager.command";

export const administration = new Hono<UserEnv>()
  .get("/", organizationOverviewRedirect)
  .use("/:organization/*", managersOnly)
  .get("/:organization", organizationOverview)
  .on(["GET", "POST"], "/:organization/projects", chooseOpenProjects)
  .get("/:organization/managers", managerList)
  .post("/:organization/managers/:userId", makeManager)
  .post("/:organization/managers/:userId/delete", removeManager);
