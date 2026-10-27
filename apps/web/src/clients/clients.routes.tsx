import { Hono } from "hono";
import { managersOnly } from "../domain/managers/manager.middleware";
import type { UserEnv } from "../domain/users/user";
import { addClient } from "./addClient.command";
import { clientDetails } from "./clientDetails.query";
import { clientList } from "./clientList.query";
import { renameClient } from "./renameClient.command";

export const clients = new Hono<UserEnv>()
  .get("/", clientList)
  .on(["GET", "POST"], "/new", managersOnly, addClient)
  .on(["GET", "POST"], "/:id/edit", managersOnly, renameClient)
  .get("/:id", clientDetails);
