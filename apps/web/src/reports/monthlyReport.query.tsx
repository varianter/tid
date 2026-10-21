import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import { projects, timeEntriesExport } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { DataGrid, type DataGridColumn, EmptyState, Page, PeriodNavigation, Tabs } from "@tid/ui";
import { and, between, eq, inArray, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { Child } from "hono/jsx";
import { type Amounts, addAmounts, formatAmounts } from "../amount/amount";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { CompanySelect, resolveCompany } from "../organizations/companyFilter";
import { projectTimesheetPath } from "../projects/projectsUrl";
import { formatShare } from "../share/share";
import { capacityMinutes } from "./capacity";
import { reportQuery, type Tab, tabs } from "./period";
import { reportPath } from "./reportsUrl";

export const monthlyReport = async (c: Context<UserEnv>) => {
  const company = await resolveCompany(c);
  if (company instanceof Response) return company;
  const { selected } = company;
  const query = reportQuery(c.req.query("from"), c.req.query("tab"), todayInOslo());
  const canonicalPath = reportPath(selected.value, query);
  const url = new URL(c.req.url);
  if (`${url.pathname}${url.search}` !== canonicalPath) return c.redirect(canonicalPath);

  const from = query.get("from") ?? "";
  const till = query.get("till") ?? "";
  const tab = query.get("tab") as Tab;
  const month = from.slice(0, 7);
  const view = timeEntriesExport;
  const inReport = and(
    inArray(
      view.accountName,
      selected.organizations.map((organization) => organization.legalName),
    ),
    between(view.spentDate, from, till),
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
  const capacityHours = capacityMinutes(month, selected.country, selected.fullDayMinutes) / 60;

  const report = await (async (): Promise<ReportRows> => {
    switch (tab) {
      case "clients":
        return {
          tab,
          rows: mergeCurrencies(
            await database
              .select({ name: view.clientName, ...totals })
              .from(view)
              .innerJoin(projects, eq(projects.code, view.projectCode))
              .where(inReport)
              .groupBy(view.clientName, projects.currency)
              .orderBy(view.clientName),
          ),
        };
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
      case "consultants":
        return {
          tab,
          rows: mergeCurrencies(
            await database
              .select({ email: view.userEmail, name: view.userName, ...totals })
              .from(view)
              .innerJoin(projects, eq(projects.code, view.projectCode))
              .where(inReport)
              .groupBy(view.userEmail, view.userName, projects.currency)
              .orderBy(view.userName),
          ),
        };
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
  const monthPath = (months: number) =>
    reportPath(selected.value, reportQuery(`${addMonths(month, months)}-01`, tab, todayInOslo()));

  return c.render(
    <ReportPage
      companySelect={<CompanySelect {...company} keep={{ from, tab }} />}
      month={month}
      report={report}
      total={total}
      currency={currency}
      capacityHours={capacityHours}
      previousHref={monthPath(-1)}
      nextHref={monthPath(1)}
      tabHref={(tabName) => reportPath(selected.value, reportQuery(from, tabName, todayInOslo()))}
      projectHref={(id) => projectTimesheetPath(id, month, selected.value)}
    />,
  );
};

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
  | { tab: "clients"; rows: (Totals & { name: string })[] }
  | {
      tab: "projects";
      rows: (Totals & { id: number; code: string; name: string; client: string })[];
    }
  | { tab: "consultants"; rows: (Totals & { email: string; name: string })[] }
  | { tab: "tasks"; rows: (Totals & { name: string })[] };

type ReportTable = {
  columns: DataGridColumn[];
  rows: { cells: Child[]; href?: string }[];
  footer: Child[];
};

const tabLabels: Record<Tab, string> = {
  clients: "Clients",
  projects: "Projects",
  consultants: "Consultants",
  tasks: "Tasks",
};

function ReportPage({
  companySelect,
  month,
  report,
  total,
  currency,
  capacityHours,
  previousHref,
  nextHref,
  tabHref,
  projectHref,
}: {
  companySelect: Child;
  month: string;
  report: ReportRows;
  total: Totals;
  currency: string;
  capacityHours: number;
  previousHref: string;
  nextHref: string;
  tabHref: (tab: Tab) => string;
  projectHref: (projectId: number) => string;
}) {
  const table = reportTable(report, total, currency, capacityHours, projectHref);
  return (
    <Page
      title="Reports"
      actions={
        <>
          {companySelect}
          <PeriodNavigation
            previousHref={previousHref}
            nextHref={nextHref}
            previousLabel="Previous month"
            nextLabel="Next month"
          >
            {formatDate(month, "month")}
          </PeriodNavigation>
        </>
      }
    >
      <Summary {...total} currency={currency} />
      <section>
        <Tabs aria-label="Group by">
          {tabs.map((tabName) => (
            <Tabs.Link href={tabHref(tabName)} active={tabName === report.tab}>
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
    </Page>
  );
}

function reportTable(
  report: ReportRows,
  total: Totals,
  currency: string,
  capacityHours: number,
  projectHref: (projectId: number) => string,
): ReportTable {
  switch (report.tab) {
    case "clients":
      return {
        columns: [
          { label: "Name" },
          { label: "Hours", kind: "number" },
          { label: "Billable hours", kind: "number" },
          { label: "Billable amount", kind: "number" },
        ],
        rows: report.rows.map((row) => ({
          cells: [
            <DataGrid.Title>{row.name}</DataGrid.Title>,
            formatTotalHours(row.hours * 60),
            formatTotalHours(row.billableHours * 60),
            formatAmounts(row.amounts, currency),
          ],
        })),
        footer: [
          "Total",
          formatTotalHours(total.hours * 60),
          formatTotalHours(total.billableHours * 60),
          formatAmounts(total.amounts, currency),
        ],
      };
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
            formatShare(row.hours, capacityHours),
            <BillableHours hours={row.hours} billableHours={row.billableHours} />,
            formatAmounts(row.amounts, currency),
          ],
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
  currency,
}: Totals & { currency: string }) {
  const nonBillableHours = hours - billableHours;

  return (
    <dl class="stack-h items-start gap-xl b-all bc-default br-l p-m t-tabular">
      <Stat label="Total" value={formatTotalHours(hours * 60)} />
      <Stat
        label="Billable"
        value={formatTotalHours(billableHours * 60)}
        share={formatShare(billableHours, hours)}
      />
      <Stat
        label="Non-billable"
        value={formatTotalHours(nonBillableHours * 60)}
        share={formatShare(nonBillableHours, hours)}
      />
      <Stat
        label="Billable amount"
        value={formatAmounts(amounts, currency)}
        note={
          unratedHours > 0
            ? `${formatTotalHours(unratedHours * 60)} logged without a rate`
            : undefined
        }
      />
    </dl>
  );
}

function Stat({
  label,
  value,
  share,
  note,
}: {
  label: string;
  value: string;
  share?: string;
  note?: string;
}) {
  return (
    <div class="stack-v gap-3xs flex-1">
      <dt class="fs-s ink-subtle">{label}</dt>
      <dd class="stack-h nowrap items-baseline gap-xs">
        <span class="fs-l fw-medium">{value}</span>
        {share && <span class="ink-subtle">{share}</span>}
      </dd>
      {note && <dd class="fs-xs ink-subtle">{note}</dd>}
    </div>
  );
}

function BillableHours({ hours, billableHours }: { hours: number; billableHours: number }) {
  return (
    <span class="stack-h nowrap justify-end gap-xs">
      {formatTotalHours(billableHours * 60)}
      <span class="ink-subtle fw-regular">{formatShare(billableHours, hours)}</span>
    </span>
  );
}
