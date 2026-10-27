import { z } from "zod";
import { billableField } from "../billable/billableFilter";
import { organizationField } from "../organizations/organizationFilter";
import { monthField } from "../query/pageMonth";
import { pageUrl } from "../query/pageUrl";

export const tabs = ["projects", "consultants", "tasks"] as const;
export type Tab = (typeof tabs)[number];

export const reportUrl = pageUrl(
  "/reports",
  z.object({
    ...organizationField,
    ...monthField,
    tab: z.enum(tabs).catch(tabs[0]),
    ...billableField,
  }),
);
