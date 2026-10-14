import { Hono } from "hono";
import { addRate } from "./addRate.command";
import { assignConsultant } from "./assignConsultant.command";
import { deleteRate } from "./deleteRate.command";
import { removeConsultant } from "./removeConsultant.command";
import { repriceEntries } from "./repriceEntries.command";

// Mounted under /projects/:projectId/assignments.
export const assignments = new Hono()
  .post("/", assignConsultant)
  .post("/:userId/delete", removeConsultant)
  .on(["GET", "POST"], "/:userId/rates", addRate)
  .on(["GET", "POST"], "/:userId/rates/reprice", repriceEntries)
  .post("/:userId/rates/:validFrom/delete", deleteRate);
