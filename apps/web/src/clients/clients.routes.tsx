import { Hono } from "hono";
import { addClient } from "./addClient.command";
import { clientDetails } from "./clientDetails.query";
import { clientList } from "./clientList.query";
import { renameClient } from "./renameClient.command";

export const clients = new Hono()
  .get("/", clientList)
  .on(["GET", "POST"], "/new", addClient)
  .on(["GET", "POST"], "/:id/edit", renameClient)
  .get("/:id", clientDetails);
