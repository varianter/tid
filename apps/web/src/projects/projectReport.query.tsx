import { formatMonth } from "@tid/calendar/dateDisplay";
import { formatTotalHours } from "@tid/elements/hours";
import { DataGrid, Detail, EmptyState, Page, PeriodNavigation, Tabs } from "@tid/ui";
import type { Context } from "hono";
import { formatAmount } from "../domain/amount/amount";
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
import {
  type EntryTotal,
  loadEntryTotals,
  loadProjectEntries,
  loadProjectReport,
} from "./projectReport.data";
import { type ProjectReportTab, projectReportTabs, projectReportUrl } from "./projects.url";

/** What the chosen tab shows of the entries. */
type EntriesView =
  | { tab: "details"; entries: MonthEntry[] }
  | { tab: "consultants" | "tasks"; totals: EntryTotal[] };

export const projectReport = queryPage({
  url: projectReportUrl,
  complete: completeOrganization,
  loader: async (c: Context<UserEnv>, { projectId, month, tab }) => {
    const organizationFilter = await resolveOrganizationFilter(c);
    if (organizationFilter instanceof Response) return organizationFilter;
    const { selected } = organizationFilter;
    const report = await loadProjectReport(projectId, month, selected);
    if (!report) return c.notFound();
    const entriesView: EntriesView =
      tab === "details"
        ? { tab, entries: await loadProjectEntries(projectId, month, selected) }
        : {
            tab,
            totals: await loadEntryTotals(
              projectId,
              month,
              selected,
              tab === "consultants" ? "consultant" : "task",
            ),
          };
    return { organizationFilter, report, entriesView };
  },
  view: ProjectReportPage,
});

const isEmpty = (view: EntriesView) =>
  (view.tab === "details" ? view.entries : view.totals).length === 0;

const tabLabels: Record<ProjectReportTab, string> = {
  consultants: "Consultants",
  tasks: "Tasks",
  details: "Details",
};

function ProjectReportPage({
  organizationFilter,
  report,
  entriesView,
  query,
  href,
}: {
  organizationFilter: OrganizationFilter;
  report: ProjectReport;
  entriesView: EntriesView;
} & QueryProps<typeof projectReportUrl>) {
  const { project, period, hours, amount } = report;
  return (
    <Page
      title={project.name}
      description={`Report for ${period}`}
      back={{ href: `/projects/${project.id}`, label: "Back to project" }}
      period={
        <PeriodNavigation
          previousHref={href({ month: query.month.subtract({ months: 1 }) })}
          nextHref={href({ month: query.month.add({ months: 1 }) })}
          previousLabel="Previous month"
          nextLabel="Next month"
          years={yearsAround(query.month, href)}
        >
          {period}
        </PeriodNavigation>
      }
    >
      <Filtered by={<OrganizationSelect {...organizationFilter} />}>
        <dl class="stack-h items-start gap-xl gap-row-s b-all bc-default br-l p-m">
          <Detail label="Client">
            <a href={`/clients/${project.clientId}`}>{project.client}</a>
          </Detail>
          <Detail label="Code">{project.code}</Detail>
          <Detail label="Billing">{billingLabels[project.billing]}</Detail>
          <Detail label="Hours">{formatTotalHours(hours * 60)}</Detail>
          {amount !== undefined && project.currency && (
            <Detail label={`Amount (${project.currency})`}>
              {formatAmount(amount, project.currency, "exact")}
            </Detail>
          )}
        </dl>
        <section>
          <Tabs aria-label="Show entries by">
            {projectReportTabs.map((tab) => (
              <Tabs.Link href={href({ tab })} active={tab === query.tab}>
                {tabLabels[tab]}
              </Tabs.Link>
            ))}
          </Tabs>
          <div class="b-all bc-subtle br-l p-m mt-s">
            {isEmpty(entriesView) ? (
              <EmptyState title="No hours logged">
                No time was logged in {formatMonth(query.month)}.
              </EmptyState>
            ) : entriesView.tab === "details" ? (
              <MonthEntries
                month={query.month}
                entries={entriesView.entries}
                titleLabel="Consultant"
              />
            ) : (
              <EntryTotals
                totals={entriesView.totals}
                groupedBy={entriesView.tab === "consultants" ? "consultant" : "task"}
              />
            )}
          </div>
        </section>
      </Filtered>
    </Page>
  );
}

/** Who logged it and on what: a group is one, and its rows break it down by the other. */
const groupings = {
  consultant: {
    groupKey: (total: EntryTotal) => total.consultantId,
    groupName: (total: EntryTotal) => total.consultant,
    rowName: (total: EntryTotal) => total.task,
    groupLabel: "Consultant",
  },
  task: {
    groupKey: (total: EntryTotal) => total.taskId,
    groupName: (total: EntryTotal) => total.task,
    rowName: (total: EntryTotal) => total.consultant,
    groupLabel: "Task",
  },
};

/**
 * The month's entries added up per consultant and task: a row per consultant or per task with its
 * total, broken down by the other beneath it, in the order given.
 */
function EntryTotals({
  totals,
  groupedBy,
}: {
  totals: EntryTotal[];
  groupedBy: keyof typeof groupings;
}) {
  const { groupKey, groupName, rowName, groupLabel } = groupings[groupedBy];
  const groups = [...Map.groupBy(totals, groupKey).values()].flatMap((rows) => {
    const [first] = rows;
    return first ? [{ name: groupName(first), rows }] : [];
  });
  return (
    <DataGrid columns={[{ label: groupLabel }, { label: "Hours", kind: "number" }]}>
      {groups.map(({ name, rows }) => (
        <>
          <DataGrid.Row>
            <DataGrid.Title>{name}</DataGrid.Title>
            {formatTotalHours(rows.reduce((sum, row) => sum + row.minutes, 0))}
          </DataGrid.Row>
          {rows.map((row) => (
            <DataGrid.Row nested>
              {rowName(row)}
              {formatTotalHours(row.minutes)}
            </DataGrid.Row>
          ))}
        </>
      ))}
    </DataGrid>
  );
}
