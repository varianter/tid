import { Hono } from "hono";
import { managersOnly } from "../domain/managers/manager.middleware";
import type { UserEnv } from "../domain/users/user";
import { addClient } from "./addClient.command";
import { chooseAccountManagers } from "./chooseAccountManagers.command";
import { clientDetails } from "./clientDetails.query";
import { clientList } from "./clientList.query";
import { confirmOrganizationNumber } from "./confirmOrganizationNumber.command";
import { enterOrganizationNumber } from "./enterOrganizationNumber.command";
import { renameClient } from "./renameClient.command";

export const clients = new Hono<UserEnv>()
  .get("/", clientList)
  .on(["GET", "POST"], "/new", managersOnly, addClient)
  .on(["GET", "POST"], "/:id/edit", managersOnly, renameClient)
  .on(["GET", "POST"], "/:id/account-managers", managersOnly, chooseAccountManagers)
  .on(["GET", "POST"], "/:id/organization-number", managersOnly, enterOrganizationNumber)
  .on(["GET", "POST"], "/:id/organization-number/confirm", managersOnly, confirmOrganizationNumber)
  .get("/:id", clientDetails);
