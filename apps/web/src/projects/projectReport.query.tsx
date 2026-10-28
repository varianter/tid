import { addMonths } from "@tid/calendar/isoDate";
import { formatTotalHours } from "@tid/elements/hours";
import { Button, Detail, Page, PeriodNavigation } from "@tid/ui";
import type { Context } from "hono";
import {
  completeOrganization,
  type OrganizationFilter,
  OrganizationSelect,
  resolveOrganizationFilter,
} from "../domain/organizations/organizationFilter";
import type { UserEnv } from "../domain/users/user";
import { Filtered } from "../framework/filter";
import { yearsAround } from "../framework/periodNavigation";
import { type QueryProps, queryPage } from "../framework/queryPage";
import { MonthEntries, type MonthEntry } from "../timeEntries/monthEntries";
import { billingLabels } from "./billing";
import type { ProjectReport } from "./projectReport";
import { loadProjectEntries, loadProjectReport } from "./projectReport.data";
import { projectReportPrintUrl, projectReportUrl } from "./projects.url";

export const projectReport = queryPage({
  url: projectReportUrl,
  complete: completeOrganization,
  loader: async (c: Context<UserEnv>, { projectId, month }) => {
    const organizationFilter = await resolveOrganizationFilter(c);
    if (organizationFilter instanceof Response) return organizationFilter;
    const report = await loadProjectReport(projectId, month, organizationFilter.selected);
    if (!report) return c.notFound();
    const entries = await loadProjectEntries(projectId, month, organizationFilter.selected);
    return { organizationFilter, report, entries };
  },
  view: ProjectReportPage,
});

function ProjectReportPage({
  organizationFilter,
  report,
  entries,
  query,
  href,
}: {
  organizationFilter: OrganizationFilter;
  report: ProjectReport;
  entries: MonthEntry[];
} & QueryProps<typeof projectReportUrl>) {
  const { project, period, hours, amount } = report;
  return (
    <Page
      title={project.name}
      description={`Report for ${period}`}
      back={{ href: `/projects/${project.id}`, label: "Back to project" }}
    >
      <Filtered
        by={
          <>
            <OrganizationSelect {...organizationFilter} />
            <PeriodNavigation
              previousHref={href({ month: addMonths(query.month, -1) })}
              nextHref={href({ month: addMonths(query.month, 1) })}
              previousLabel="Previous month"
              nextLabel="Next month"
              years={yearsAround(query.month, href)}
            >
              {period}
            </PeriodNavigation>
          </>
        }
      >
        <dl class="stack-h items-start gap-xl gap-row-s b-all bc-default br-l p-m">
          <Detail label="Client">
            <a href={`/clients/${project.clientId}`}>{project.client}</a>
          </Detail>
          <Detail label="Code">{project.code}</Detail>
          <Detail label="Billing">{billingLabels[project.billing]}</Detail>
          <Detail label="Hours">{formatTotalHours(hours * 60)}</Detail>
          {amount && <Detail label="Amount">{amount}</Detail>}
        </dl>
        <MonthEntries month={query.month} entries={entries} titleLabel="Consultant" />
        <div>
          <Button as="a" href={projectReportPrintUrl.path(query)} data-variant="outlined">
            Print
          </Button>
        </div>
      </Filtered>
    </Page>
  );
}
