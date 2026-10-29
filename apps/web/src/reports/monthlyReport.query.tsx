import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { projects, timeEntriesExport, users } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import {
  DataGrid,
  type DataGridColumn,
  EmptyState,
  Page,
  PeriodNavigation,
  ProgressBar,
  Stat,
  StatList,
  Tabs,
} from "@tid/ui";
import { and, between, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { Child } from "hono/jsx";
import { consultantPath } from "../consultants/consultants.url";
import { type Amounts, addAmounts, formatAmounts } from "../domain/amount/amount";
import { capacityMinutes } from "../domain/capacity/capacity";
import {
  completeOrganization,
  type OrganizationFilter,
  OrganizationSelect,
  resolveOrganizationFilter,
} from "../domain/organizations/organizationFilter";
import { database } from "../framework/database";
import { Filtered } from "../framework/filter";
import { yearsAround } from "../framework/periodNavigation";
import { type QueryProps, queryPage } from "../framework/queryPage";
import { projectReportUrl } from "../projects/projects.url";
import { formatShare } from "../share/share";
import { BillableSelect, billableCondition } from "./billableFilter";
import { reportUrl, type Tab, tabs } from "./reports.url";

export const monthlyReport = queryPage({
  url: reportUrl,
  complete: completeOrganization,
  loader: async (c, { month, tab, billable }) => {
    const organizationFilter = await resolveOrganizationFilter(c);
    if (organizationFilter instanceof Response) return organizationFilter;
    const { selected } = organizationFilter;
    const view = timeEntriesExport;
    const inReport = and(
      inArray(
        view.accountName,
        selected.organizations.map((organization) => organization.legalName),
      ),
      between(view.spentDate, firstDayOfMonth(month), lastDayOfMonth(month)),
      billableCondition(billable, view.billable),
    );

    const totals = {
      hours: sql`sum(${view.hours})`.mapWith(Number),
      billableHours: sql`sum(${view.billableHours})`.mapWith(Number),
      // Grouped by currency as well, then merged by mergeCurrencies.
      currency: projects.currency,
      amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
      // Fixed fee time has no amount by design, so only hourly time can be missing a rate.
      unratedHours: sql`coalesce(sum(${view.billableHours}) filter (
      where ${view.amount} is null
        and ${view.projectCode} in (select ${projects.code} from ${projects} where ${projects.billing} = 'hourly')
    ), 0)`.mapWith(Number),
    };
    // Shown as the amount when nothing was billed, since there's no currency to show it in.
    const currency = selected.currency;

    const report = await (async (): Promise<ReportRows> => {
      switch (tab) {
        case "projects":
          return {
            tab,
            rows: mergeCurrencies(
              await database
                .select({
                  id: projects.id,
                  code: view.projectCode,
                  name: view.projectName,
                  client: view.clientName,
                  ...totals,
                })
                .from(view)
                .innerJoin(projects, eq(projects.code, view.projectCode))
                .where(inReport)
                .groupBy(
                  projects.id,
                  view.projectCode,
                  view.projectName,
                  view.clientName,
                  projects.currency,
                )
                .orderBy(view.projectName),
            ),
          };
        case "consultants": {
          const rows = mergeCurrencies(
            await database
              .select({
                id: users.id,
                email: view.userEmail,
                name: view.userName,
                endsOn: users.endsOn,
                ...totals,
              })
              .from(view)
              .innerJoin(projects, eq(projects.code, view.projectCode))
              .innerJoin(users, eq(users.email, view.userEmail))
              .where(inReport)
              .groupBy(users.id, view.userEmail, view.userName, projects.currency)
              .orderBy(view.userName),
          );
          return {
            tab,
            rows: rows.map(({ endsOn, ...row }) => ({
              ...row,
              capacityHours:
                capacityMinutes(month, selected.country, selected.fullDayMinutes, endsOn) / 60,
            })),
          };
        }
        case "tasks":
          return {
            tab,
            rows: mergeCurrencies(
              await database
                .select({ name: view.taskName, ...totals })
                .from(view)
                .innerJoin(projects, eq(projects.code, view.projectCode))
                .where(inReport)
                .groupBy(view.taskName, projects.currency)
                .orderBy(view.taskName),
            ),
          };
      }
    })();

    // Every tab groups the same entries, so its rows add up to the whole report.
    const rows: Totals[] = report.rows;
    const sumOf = (field: "hours" | "billableHours" | "unratedHours") =>
      rows.reduce((total, row) => total + row[field], 0);
    const total: Totals = {
      hours: sumOf("hours"),
      billableHours: sumOf("billableHours"),
      amounts: rows.reduce<Amounts>((total, row) => addAmounts(total, row.amounts), {}),
      unratedHours: sumOf("unratedHours"),
    };
    // Everyone employed in the month, including those who logged nothing.
    const employed = await database
      .select({ endsOn: users.endsOn })
      .from(users)
      .where(
        and(
          inArray(
            users.orgId,
            selected.organizations.map((organization) => organization.id),
          ),
          or(isNull(users.endsOn), gte(users.endsOn, firstDayOfMonth(month))),
        ),
      );
    const capacityHours =
      employed.reduce(
        (sum, { endsOn }) =>
          sum + capacityMinutes(month, selected.country, selected.fullDayMinutes, endsOn),
        0,
      ) / 60;
    return { organizationFilter, report, total, capacityHours, currency };
  },
  view: ReportPage,
});

type Totals = { hours: number; billableHours: number; amounts: Amounts; unratedHours: number };

// Non-billable projects have no currency, but no amount either.
type CurrencyTotals = Omit<Totals, "amounts"> & { currency: string | null; amount: number };

type Merged<Row> = Omit<Row, "currency" | "amount"> & Totals;

/**
 * Merges rows that differ only by currency. The queries group by currency so amounts in different
 * currencies aren't added, and order by their other columns so those rows are adjacent.
 */
export function mergeCurrencies<Row extends CurrencyTotals>(rows: Row[]): Merged<Row>[] {
  const merged: Merged<Row>[] = [];
  let previousKey: string | undefined;
  for (const { currency, amount, hours, billableHours, unratedHours, ...dimension } of rows) {
    const key = JSON.stringify(dimension);
    const amounts = amount === 0 || currency === null ? {} : { [currency]: amount };
    const last = merged.at(-1);
    if (last && key === previousKey) {
      last.hours += hours;
      last.billableHours += billableHours;
      last.unratedHours += unratedHours;
      last.amounts = addAmounts(last.amounts, amounts);
    } else {
      merged.push({ ...dimension, hours, billableHours, unratedHours, amounts } as Merged<Row>);
    }
    previousKey = key;
  }
  return merged;
}

/** One tab's rows, each grouping the report's entries by that tab's dimension. */
export type ReportRows =
  | {
      tab: "projects";
      rows: (Totals & { id: number; code: string; name: string; client: string })[];
    }
  | {
      tab: "consultants";
      rows: (Totals & { id: number; email: string; name: string; capacityHours: number })[];
    }
  | { tab: "tasks"; rows: (Totals & { name: string })[] };

type ReportTable = {
  columns: DataGridColumn[];
  rows: { cells: Child[]; href?: string }[];
  footer: Child[];
};

const tabLabels: Record<Tab, string> = {
  projects: "Projects",
  consultants: "Consultants",
  tasks: "Tasks",
};

function ReportPage({
  organizationFilter,
  report,
  total,
  capacityHours,
  currency,
  query,
  href,
}: {
  organizationFilter: OrganizationFilter;
  report: ReportRows;
  total: Totals;
  capacityHours: number;
  currency: string;
} & QueryProps<typeof reportUrl>) {
  const { month } = query;
  const projectHref = (projectId: number) =>
    projectReportUrl.path({ projectId, month, organization: organizationFilter.selected.value });
  const consultantHref = (userId: number) => consultantPath(userId, month);
  const table = reportTable(report, total, currency, projectHref, consultantHref);
  return (
    <Page title="Reports">
      <Filtered
        by={
          <>
            <OrganizationSelect {...organizationFilter} />
            <BillableSelect />
            <PeriodNavigation
              previousHref={href({ month: addMonths(month, -1) })}
              nextHref={href({ month: addMonths(month, 1) })}
              previousLabel="Previous month"
              nextLabel="Next month"
              years={yearsAround(month, href)}
            >
              {formatDate(month, "month")}
            </PeriodNavigation>
          </>
        }
      >
        <Summary {...total} capacityHours={capacityHours} currency={currency} />
        <section>
          <Tabs aria-label="Group by">
            {tabs.map((tabName) => (
              <Tabs.Link href={href({ tab: tabName })} active={tabName === report.tab}>
                {tabLabels[tabName]}
              </Tabs.Link>
            ))}
          </Tabs>
          <div class="b-all bc-subtle br-l p-m mt-s">
            {table.rows.length === 0 ? (
              <EmptyState emoji="🗓️" title="No hours logged">
                No time was logged in {formatDate(month, "month")}.
              </EmptyState>
            ) : (
              <DataGrid columns={table.columns}>
                {table.rows.map((row) => (
                  <DataGrid.Row href={row.href}>{row.cells}</DataGrid.Row>
                ))}
                <DataGrid.Footer>{table.footer}</DataGrid.Footer>
              </DataGrid>
            )}
          </div>
        </section>
      </Filtered>
    </Page>
  );
}

function reportTable(
  report: ReportRows,
  total: Totals,
  currency: string,
  projectHref: (projectId: number) => string,
  consultantHref: (userId: number) => string,
): ReportTable {
  switch (report.tab) {
    case "projects":
      return {
        columns: [
          { label: "Name" },
          { label: "Client" },
          { label: "Hours", kind: "number" },
          { label: "Billable hours", kind: "number" },
          { label: "Billable amount", kind: "number" },
        ],
        rows: report.rows.map((row) => ({
          cells: [
            <DataGrid.Title secondary={row.code}>{row.name}</DataGrid.Title>,
            row.client,
            formatTotalHours(row.hours * 60),
            formatTotalHours(row.billableHours * 60),
            formatAmounts(row.amounts, currency),
          ],
          href: projectHref(row.id),
        })),
        footer: [
          "Total",
          "",
          formatTotalHours(total.hours * 60),
          formatTotalHours(total.billableHours * 60),
          formatAmounts(total.amounts, currency),
        ],
      };
    case "consultants":
      return {
        columns: [
          { label: "Name" },
          { label: "Hours", kind: "number" },
          { label: "Utilization", kind: "number" },
          { label: "Billable hours", kind: "number" },
          { label: "Billable amount", kind: "number" },
        ],
        rows: report.rows.map((row) => ({
          cells: [
            <DataGrid.Title>{row.name}</DataGrid.Title>,
            formatTotalHours(row.hours * 60),
            <Utilization hours={row.hours} capacityHours={row.capacityHours} />,
            <BillableHours hours={row.hours} billableHours={row.billableHours} />,
            formatAmounts(row.amounts, currency),
          ],
          href: consultantHref(row.id),
        })),
        // Utilization has no total, since consultants who started or left mid-month skew any sum.
        footer: [
          "Total",
          formatTotalHours(total.hours * 60),
          "",
          <BillableHours hours={total.hours} billableHours={total.billableHours} />,
          formatAmounts(total.amounts, currency),
        ],
      };
    case "tasks":
      return {
        columns: [
          { label: "Name" },
          { label: "Billable hours", kind: "number" },
          { label: "Billable amount", kind: "number" },
        ],
        rows: report.rows.map((row) => ({
          cells: [
            <DataGrid.Title>{row.name}</DataGrid.Title>,
            formatTotalHours(row.billableHours * 60),
            formatAmounts(row.amounts, currency),
          ],
        })),
        footer: [
          "Total",
          formatTotalHours(total.billableHours * 60),
          formatAmounts(total.amounts, currency),
        ],
      };
  }
}

function Summary({
  hours,
  billableHours,
  amounts,
  unratedHours,
  capacityHours,
  currency,
}: Totals & { capacityHours: number; currency: string }) {
  return (
    <StatList>
      <Stat
        label="Logged"
        value={formatTotalHours(hours * 60)}
        share={formatShare(hours, capacityHours)}
        note={`of ${formatTotalHours(capacityHours * 60)} capacity`}
      >
        <ProgressBar max={capacityHours} segments={[{ value: hours, palette: "purple" }]} />
      </Stat>
      <Stat
        label="Billable"
        value={formatTotalHours(billableHours * 60)}
        share={formatShare(billableHours, hours)}
        note={`${formatTotalHours((hours - billableHours) * 60)} non-billable`}
      >
        <ProgressBar
          max={hours}
          segments={[
            { value: billableHours, palette: "blue" },
            { value: hours - billableHours, palette: "blue", shade: "soft" },
          ]}
        />
      </Stat>
      <Stat label="Billable amount" value={formatAmounts(amounts, currency)} />
      <Stat
        label="Without a rate"
        value={formatTotalHours(unratedHours * 60)}
        note={unratedHours > 0 ? "Hourly time that bills nothing" : "Everyone has a rate"}
      />
    </StatList>
  );
}

// In em so the bars scale with the table text.
const barWidth = "width: 6em;";

function BillableHours({ hours, billableHours }: { hours: number; billableHours: number }) {
  return (
    <span class="stack-h flex-nowrap items-center justify-end gap-xs">
      {formatTotalHours(billableHours * 60)}
      <span class="ink-subtle fw-regular">{formatShare(billableHours, hours)}</span>
      <span style={barWidth}>
        <ProgressBar
          max={hours}
          segments={[
            { value: billableHours, palette: "blue" },
            { value: hours - billableHours, palette: "blue", shade: "soft" },
          ]}
        />
      </span>
    </span>
  );
}

function Utilization({ hours, capacityHours }: { hours: number; capacityHours: number }) {
  return (
    <span class="stack-h flex-nowrap items-center justify-end gap-xs">
      {formatShare(hours, capacityHours)}
      <span style={barWidth}>
        <ProgressBar max={capacityHours} segments={[{ value: hours, palette: "purple" }]} />
      </span>
    </span>
  );
}
