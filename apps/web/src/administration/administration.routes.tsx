import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly } from "../managers/manager";
import { closeProjectToMembers } from "./closeProjectToMembers.command";
import { makeManager } from "./makeManager.command";
import { managerList } from "./managerList.query";
import { openProjectList } from "./openProjectList.query";
import { openProjectToMembers } from "./openProjectToMembers.command";
import { organizationOverview, organizationOverviewRedirect } from "./organizationOverview.query";
import { removeManager } from "./removeManager.command";

export const administration = new Hono<UserEnv>()
  .get("/", organizationOverviewRedirect)
  .use("/:organization/*", managersOnly)
  .get("/:organization", organizationOverview)
  .get("/:organization/projects", openProjectList)
  .post("/:organization/projects", openProjectToMembers)
  .post("/:organization/projects/:projectId/delete", closeProjectToMembers)
  .get("/:organization/managers", managerList)
  .post("/:organization/managers/:userId", makeManager)
  .post("/:organization/managers/:userId/delete", removeManager);
