import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly, projectManagersOnly } from "../managers/manager.middleware";
import { addTask } from "./addTask.command";
import { chooseBilling } from "./chooseBilling.query";
import { editProject } from "./editProject.command";
import { projectDetails } from "./projectDetails.query";
import { projectList } from "./projectList.query";
import { projectReport } from "./projectReport.query";
import { projectReportPrint } from "./projectReportPrint.query";
import { startProject } from "./startProject.command";

export const projects = new Hono<UserEnv>()
  .get("/", projectList)
  .get("/new", managersOnly, chooseBilling)
  .on(["GET", "POST"], "/new/:billing", managersOnly, startProject)
  .get("/:id", projectDetails)
  .get("/:projectId/report", projectReport)
  .get("/:projectId/report/print", projectReportPrint)
  .on(["GET", "POST"], "/:id/edit", projectManagersOnly, editProject)
  .on(["GET", "POST"], "/:id/tasks/new", projectManagersOnly, addTask);
