import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly, projectManagersOnly } from "../managers/manager.middleware";
import { addRate } from "./addRate.command";
import { assignConsultants } from "./assignConsultants.command";
import { deleteRate } from "./deleteRate.command";
import { endAssignment } from "./endAssignment.command";
import { projectRates } from "./projectRates.query";
import { repriceEntries } from "./repriceEntries.command";

// Mounted under /projects/:projectId/consultants.
// Any manager may assign their own organization's consultants, which brings it into the project;
// assignConsultants checks that. Everything else is for the project's managers.
export const projectConsultants = new Hono<UserEnv>()
  .on(["GET", "POST"], "/new", managersOnly, assignConsultants)
  .get("/rates", projectManagersOnly, projectRates)
  .use("/:userId/*", projectManagersOnly)
  .on(["GET", "POST"], "/:userId/end", endAssignment)
  .on(["GET", "POST"], "/:userId/rates/new", addRate)
  .on(["GET", "POST"], "/:userId/rates/reprice", repriceEntries)
  .post("/:userId/rates/:validFrom/delete", deleteRate);
