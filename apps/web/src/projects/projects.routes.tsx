import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly } from "../users/manager";
import { addTask } from "./addTask.command";
import { editProject } from "./editProject.command";
import { projectDetails } from "./projectDetails.query";
import { projectList } from "./projectList.query";
import { projectTimesheet } from "./projectTimesheet.query";
import { startProject } from "./startProject.command";

export const projects = new Hono<UserEnv>()
  .get("/", projectList)
  .on(["GET", "POST"], "/new", managersOnly, startProject)
  .get("/:id", projectDetails)
  .get("/:id/timesheet/:month", projectTimesheet)
  .on(["GET", "POST"], "/:id/edit", managersOnly, editProject)
  .post("/:id/tasks", managersOnly, addTask);
