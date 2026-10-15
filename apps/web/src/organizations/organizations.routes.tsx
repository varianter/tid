import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { closeProjectToMembers } from "./closeProjectToMembers.command";
import { openProjectList } from "./openProjectList.query";
import { openProjectToMembers } from "./openProjectToMembers.command";

export const organizations = new Hono<UserEnv>()
  .get("/:organization/projects", openProjectList)
  .post("/:organization/projects", openProjectToMembers)
  .post("/:organization/projects/:projectId/delete", closeProjectToMembers);
