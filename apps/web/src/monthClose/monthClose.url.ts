import { z } from "zod";
import { organizationField } from "../domain/organizations/organizationFilter";
import { monthParam } from "../framework/pageMonth";
import { pageUrl } from "../framework/pageUrl";
import { fixedPriceField } from "../projects/fixedPriceFilter";

/** Where every organization's month close stands, and what its consultants billed. */
export const monthCloseOverviewUrl = pageUrl(
  "/month-close/:month",
  z.object({ month: monthParam, ...fixedPriceField }),
);

/** One organization's consultants and the hours they still owe, where its month gets locked. */
export const consultantHoursUrl = pageUrl(
  "/month-close/:month/consultants",
  z.object({ month: monthParam, ...organizationField }),
);

/** The projects to invoice for a month, whichever organization owns the contract. */
export const invoiceDataUrl = pageUrl(
  "/month-close/:month/invoice-data",
  z.object({ month: monthParam, ...fixedPriceField }),
);

/** Redirects to the consultants of the month the user's organization is closing. */
export const ownConsultantHoursPath = "/month-close/consultants";

/** Where a form locks or unlocks an organization's month. */
export const monthLockPath = (organizationSlug: string, month: string, change: "lock" | "unlock") =>
  `/month-close/${organizationSlug}/${month}/${change}`;
