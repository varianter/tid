import { z } from "zod";
import { companyField } from "../organizations/companyFilter";
import { monthParam } from "../query/pageMonth";
import { pageUrl } from "../query/pageUrl";

export const monthUrl = pageUrl(
  "/month-close/:month",
  z.object({ month: monthParam, ...companyField }),
);

/** Where a form locks or unlocks an organization's month. */
export const monthLockPath = (organizationSlug: string, month: string, change: "lock" | "unlock") =>
  `/month-close/${organizationSlug}/${month}/${change}`;
