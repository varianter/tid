import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { addTask } from "./addTask.command";
import { editProject } from "./editProject.command";
import { projectDetails } from "./projectDetails.query";
import { projectList } from "./projectList.query";
import { startProject } from "./startProject.command";

export const projects = new Hono<UserEnv>()
  .get("/", projectList)
  .on(["GET", "POST"], "/new", startProject)
  .get("/:id", projectDetails)
  .on(["GET", "POST"], "/:id/edit", editProject)
  .post("/:id/tasks", addTask);
