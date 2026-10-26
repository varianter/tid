import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managersOnly } from "../managers/manager.middleware";
import { addClient } from "./addClient.command";
import { clientDetails } from "./clientDetails.query";
import { clientList } from "./clientList.query";
import { renameClient } from "./renameClient.command";

export const clients = new Hono<UserEnv>()
  .get("/", clientList)
  .on(["GET", "POST"], "/new", managersOnly, addClient)
  .on(["GET", "POST"], "/:id/edit", managersOnly, renameClient)
  .get("/:id", clientDetails);
