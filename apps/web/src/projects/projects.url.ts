import { z } from "zod";
import { organizationField } from "../domain/organizations/organizationFilter";
import { monthField } from "../framework/pageMonth";
import { idParam, pageUrl } from "../framework/pageUrl";

export const projectsPath = (organization: string) =>
  `/projects?${new URLSearchParams({ organization })}`;

const reportQuery = z.object({ projectId: idParam, ...organizationField, ...monthField });

/** A project's hours in a month, by the consultants of one organization. */
export const projectReportUrl = pageUrl("/projects/:projectId/report", reportQuery);

/** The same report, laid out for paper. */
export const projectReportPrintUrl = pageUrl("/projects/:projectId/report/print", reportQuery);
