import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly, projectManagersOnly } from "../managers/manager";
import { addRate } from "./addRate.command";
import { assignConsultant } from "./assignConsultant.command";
import { deleteRate } from "./deleteRate.command";
import { removeConsultant } from "./removeConsultant.command";
import { repriceEntries } from "./repriceEntries.command";

// Mounted under /projects/:projectId/assignments.
// Any manager may assign their own organization's consultants, which brings it into the project;
// assignConsultant checks that. Everything else is for the project's managers.
export const assignments = new Hono<UserEnv>()
  .post("/", managersOnly, assignConsultant)
  .use("/:userId/*", projectManagersOnly)
  .post("/:userId/delete", removeConsultant)
  .on(["GET", "POST"], "/:userId/rates", addRate)
  .on(["GET", "POST"], "/:userId/rates/reprice", repriceEntries)
  .post("/:userId/rates/:validFrom/delete", deleteRate);
