import { z } from "zod";
import { companyField } from "../organizations/companyFilter";
import { monthField } from "../query/pageMonth";
import { idParam, pageUrl } from "../query/pageUrl";

const reportQuery = z.object({ projectId: idParam, ...companyField, ...monthField });

/** A project's hours in a month, by the consultants of one company. */
export const projectReportUrl = pageUrl("/projects/:projectId/report", reportQuery);

/** The same report, laid out for paper. */
export const projectReportPrintUrl = pageUrl("/projects/:projectId/report/print", reportQuery);
