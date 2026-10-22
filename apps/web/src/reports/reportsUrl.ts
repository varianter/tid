import { z } from "zod";
import { billableField } from "../billable/billableFilter";
import { companyField } from "../organizations/companyFilter";
import { monthField } from "../query/pageMonth";
import { pageUrl } from "../query/pageUrl";

export const tabs = ["projects", "consultants", "tasks"] as const;
export type Tab = (typeof tabs)[number];

export const reportUrl = pageUrl(
  "/reports",
  z.object({
    ...companyField,
    ...monthField,
    tab: z.enum(tabs).catch(tabs[0]),
    ...billableField,
  }),
);
