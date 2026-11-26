import { z } from "zod";
import { organizationField } from "../domain/organizations/organizationFilter";
import { monthField } from "../framework/calendarParams";
import { idParam, pageUrl } from "../framework/pageUrl";

export const projectsPath = (organization: string) =>
  `/projects?${new URLSearchParams({ organization })}`;

/** How the report shows its entries: totals per consultant or per task, or each entry. */
export const projectReportTabs = ["consultants", "tasks", "details"] as const;
export type ProjectReportTab = (typeof projectReportTabs)[number];

/** A project's hours in a month, by the consultants of one organization. */
export const projectReportUrl = pageUrl(
  "/projects/:projectId/report",
  z.object({
    projectId: idParam,
    ...organizationField,
    ...monthField,
    tab: z.enum(projectReportTabs).catch(projectReportTabs[0]),
  }),
);
