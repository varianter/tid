import { z } from "zod";
import { monthField } from "../framework/calendarParams";
import { idParam, pageUrl } from "../framework/pageUrl";

export const projectsPath = (organization: string) =>
  `/projects?${new URLSearchParams({ organization })}`;

/** A project's hours in a month, by everyone on it. */
export const projectHoursUrl = pageUrl(
  "/projects/:projectId/hours",
  z.object({ projectId: idParam, ...monthField }),
);
