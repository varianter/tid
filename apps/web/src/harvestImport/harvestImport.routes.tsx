import { Hono } from "hono";
import type { UserEnv } from "../login/user";
import { managesOrganization } from "../users/manager";
import { enterHarvestTokens } from "./enterHarvestTokens.command";
import { forgetHarvestTokens } from "./forgetHarvestTokens.command";
import { harvestImportList } from "./harvestImportList.query";
import { importFromHarvest } from "./importFromHarvest.command";

export const harvestImport = new Hono<UserEnv>()
  // The import changes everyone's users and projects.
  .use(async (c, next) => {
    const user = c.get("user");
    if (!(await managesOrganization(user, user.orgId))) {
      return c.text("Only managers can import from Harvest", 403);
    }
    await next();
  })
  .get("/", harvestImportList)
  .on(["GET", "POST"], "/projects", importFromHarvest)
  .on(["GET", "POST"], "/tokens", enterHarvestTokens)
  .post("/forget", forgetHarvestTokens);
