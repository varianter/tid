import { z } from "zod";
import { organizationField } from "../domain/organizations/organizationFilter";
import { monthField } from "../framework/pageMonth";
import { pageUrl } from "../framework/pageUrl";
import { billableField } from "./billableFilter";

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
