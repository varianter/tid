import { Hono } from "hono";
import { managersOnly } from "../domain/managers/manager.middleware";
import type { UserEnv } from "../domain/users/user";
import { changeConsultantOrganization } from "./changeConsultantOrganization.command";

// Like the rest of administration, any manager may use it.
export const changeConsultantOrganizationRoutes = new Hono<UserEnv>().on(
  ["GET", "POST"],
  "/",
  managersOnly,
  changeConsultantOrganization,
);
