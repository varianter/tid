import type { organizations } from "@tid/db/schema";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { managesOrganization } from "../domain/managers/manager";
import { findVisibleOrganization } from "../domain/managers/manager.data";
import type { UserEnv } from "../domain/users/user";
import type { MonthParamEnv } from "../framework/calendarParams";

export type LockChangeEnv = UserEnv &
  MonthParamEnv & { Variables: { organization: typeof organizations.$inferSelect } };

/** For locking or unlocking a month, which only the organization's own managers may do. */
export const lockChangeManagersOnly = createMiddleware<LockChangeEnv>(async (c, next) => {
  const organization = await findVisibleOrganization(
    c.get("user"),
    c.req.param("organization") ?? "",
  );
  if (!organization) return c.notFound();
  if (!managesOrganization(c.get("user"), organization.id)) {
    throw new HTTPException(403, { message: "Only the organization's managers can do this" });
  }
  c.set("organization", organization);
  await next();
});
