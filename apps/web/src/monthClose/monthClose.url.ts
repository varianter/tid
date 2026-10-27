import { z } from "zod";
import { organizationField } from "../domain/organizations/organizationFilter";
import { monthParam } from "../framework/pageMonth";
import { pageUrl } from "../framework/pageUrl";

export const monthUrl = pageUrl(
  "/month-close/:month",
  z.object({ month: monthParam, ...organizationField }),
);

/** Where a form locks or unlocks an organization's month. */
export const monthLockPath = (organizationSlug: string, month: string, change: "lock" | "unlock") =>
  `/month-close/${organizationSlug}/${month}/${change}`;
