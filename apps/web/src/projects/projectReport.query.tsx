import { addMonths } from "@tid/calendar/isoDate";
import { formatTotalHours } from "@tid/elements/hours";
import { Button, Detail, Page, PeriodNavigation } from "@tid/ui";
import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import {
  type CompanyFilter,
  CompanySelect,
  completeCompany,
  resolveCompany,
} from "../organizations/companyFilter";
import { Filtered } from "../query/filter";
import { type QueryProps, queryPage } from "../query/queryPage";
import { MonthEntries, type MonthEntry } from "../timeEntries/monthEntries";
import { billingLabels } from "./billing";
import { loadProjectEntries, loadProjectReport, type ProjectReport } from "./projectReport";
import { projectReportPrintUrl, projectReportUrl } from "./projectsUrl";

export const projectReport = queryPage({
  url: projectReportUrl,
  complete: completeCompany,
  loader: async (c: Context<UserEnv>, { projectId, month }) => {
    const company = await resolveCompany(c);
    if (company instanceof Response) return company;
    const report = await loadProjectReport(projectId, month, company.selected);
    if (!report) return c.notFound();
    const entries = await loadProjectEntries(projectId, month, company.selected);
    return { company, report, entries };
  },
  view: ProjectReportPage,
});

function ProjectReportPage({
  company,
  report,
  entries,
  query,
  href,
}: {
  company: CompanyFilter;
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
            <CompanySelect {...company} />
            <PeriodNavigation
              previousHref={href({ month: addMonths(query.month, -1) })}
              nextHref={href({ month: addMonths(query.month, 1) })}
              previousLabel="Previous month"
              nextLabel="Next month"
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
