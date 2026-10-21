import { isIsoMonth } from "@tid/calendar/isoDate";
import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { managesOrganization } from "../managers/manager";
import { findOrganization } from "./monthUrl";

/** The month a lock or unlock names, once the user manages its organization. */
export async function readLockChange(c: Context<UserEnv>) {
  const month = c.req.param("month") ?? "";
  const organization = await findOrganization(c.get("user"), c.req.param("organization") ?? "");
  if (!organization || !isIsoMonth(month)) return c.notFound();
  if (!(await managesOrganization(c.get("user"), organization.id))) {
    return c.text("Only the organization's managers can do this", 403);
  }
  return { organization, month };
}
