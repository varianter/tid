import { z } from "zod";
import { organizationField } from "../domain/organizations/organizationFilter";
import { monthField } from "../framework/pageMonth";
import { idParam, pageUrl } from "../framework/pageUrl";

export const projectsPath = (organization: string) =>
  `/projects?${new URLSearchParams({ organization })}`;

/** A project's hours in a month, by the consultants of one organization. */
export const projectReportUrl = pageUrl(
  "/projects/:projectId/report",
  z.object({ projectId: idParam, ...organizationField, ...monthField }),
);
