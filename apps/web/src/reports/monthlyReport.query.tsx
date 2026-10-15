import { timeEntriesExport } from "@tid/db/schema";
import { formatHours } from "@tid/elements/hours";
import { EmptyState, Page, PeriodNavigation, Tabs } from "@tid/ui";
import { and, between, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { Child } from "hono/jsx";
import { formatAmount } from "../amount/amount";
import { database } from "../database";
import { formatMonth } from "../dates/dateDisplay";
import { addMonths } from "../dates/isoDate";
import { todayInOslo } from "../dates/osloClock";
import type { UserEnv } from "../login/user";
import { findOrganizationBySlug, findOrganizationSlug } from "../organizations/organization";
import { listOrganizations, OrganizationSelect } from "../organizations/organizationSelect";
import { formatShare } from "../share/share";
import { capacityMinutes } from "./capacity";
import { reportQuery, type Tab, tabs } from "./period";

const reportPath = (organizationSlug: string, query: URLSearchParams) =>
  `/reports/${organizationSlug}?${query}`;

// Without an organization picked, it's the user's own.
export const monthlyReportRedirect = async (c: Context<UserEnv>) => {
  const slug = c.req.query("organization") || (await findOrganizationSlug(c.get("user").orgId));
  if (!slug) return c.notFound();
  return c.redirect(
    reportPath(slug, reportQuery(c.req.query("from"), c.req.query("tab"), todayInOslo())),
  );
};

export const monthlyReport = async (c: Context<UserEnv, "/:organization">) => {
  const slug = c.req.param("organization");
  const query = reportQuery(c.req.query("from"), c.req.query("tab"), todayInOslo());
  if (new URL(c.req.url).search !== `?${query}`) return c.redirect(reportPath(slug, query));

  const organizationOptions = await listOrganizations();
  const organization = await findOrganizationBySlug(slug);
  if (!organization) return c.notFound();

  const from = query.get("from") ?? "";
  const till = query.get("till") ?? "";
  const tab = query.get("tab") as Tab;
  const month = from.slice(0, 7);
  const view = timeEntriesExport;
  const inReport = and(
    eq(view.accountName, organization.legalName),
    between(view.spentDate, from, till),
  );

  const totals = {
    hours: sql`sum(${view.hours})`.mapWith(Number),
    billableHours: sql`sum(${view.billableHours})`.mapWith(Number),
    amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
    unratedHours:
      sql`coalesce(sum(${view.billableHours}) filter (where ${view.amount} is null), 0)`.mapWith(
        Number,
      ),
  };
  const currency = organization.currency;
  const capacityHours = capacityMinutes(month, organization.fullDayMinutes) / 60;

  const report = await (async (): Promise<ReportRows> => {
    switch (tab) {
      case "clients":
        return {
          tab,
          rows: await database
            .select({ name: view.clientName, ...totals })
            .from(view)
            .where(inReport)
            .groupBy(view.clientName)
            .orderBy(view.clientName),
        };
      case "projects":
        return {
          tab,
          rows: await database
            .select({
              code: view.projectCode,
              name: view.projectName,
              client: view.clientName,
              ...totals,
            })
            .from(view)
            .where(inReport)
            .groupBy(view.projectCode, view.projectName, view.clientName)
            .orderBy(view.projectName),
        };
      case "consultants":
        return {
          tab,
          rows: await database
            .select({ email: view.userEmail, name: view.userName, ...totals })
            .from(view)
            .where(inReport)
            .groupBy(view.userEmail, view.userName)
            .orderBy(view.userName),
        };
      case "tasks":
        return {
          tab,
          rows: await database
            .select({ name: view.taskName, ...totals })
            .from(view)
            .where(inReport)
            .groupBy(view.taskName)
            .orderBy(view.taskName),
        };
    }
  })();

  // Every tab groups the same entries, so its rows add up to the whole report.
  const rows: Totals[] = report.rows;
  const sumOf = (field: keyof Totals) => rows.reduce((total, row) => total + row[field], 0);
  const total: Totals = {
    hours: sumOf("hours"),
    billableHours: sumOf("billableHours"),
    amount: sumOf("amount"),
    unratedHours: sumOf("unratedHours"),
  };
  const monthPath = (months: number) =>
    reportPath(slug, reportQuery(`${addMonths(month, months)}-01`, tab, todayInOslo()));

  return c.render(
    <ReportPage
      organizationSelect={
        <OrganizationSelect
          organizationSlug={slug}
          organizations={organizationOptions}
          action="/reports"
          keep={{ from, tab }}
        />
      }
      month={month}
      report={report}
      total={total}
      currency={currency}
      capacityHours={capacityHours}
      previousHref={monthPath(-1)}
      nextHref={monthPath(1)}
      tabHref={(tabName) => reportPath(slug, reportQuery(from, tabName, todayInOslo()))}
    />,
  );
};

type Totals = { hours: number; billableHours: number; amount: number; unratedHours: number };

/** One tab's rows, each grouping the report's entries by that tab's dimension. */
export type ReportRows =
  | { tab: "clients"; rows: (Totals & { name: string })[] }
  | { tab: "projects"; rows: (Totals & { code: string; name: string; client: string })[] }
  | { tab: "consultants"; rows: (Totals & { email: string; name: string })[] }
  | { tab: "tasks"; rows: (Totals & { name: string })[] };

type ReportTable = {
  headings: string[];
  /** How many leading columns hold text rather than figures. */
  textColumns?: number;
  rows: Child[][];
  footer: Child[];
};

const tabLabels: Record<Tab, string> = {
  clients: "Clients",
  projects: "Projects",
  consultants: "Consultants",
  tasks: "Tasks",
};

function ReportPage({
  organizationSelect,
  month,
  report,
  total,
  currency,
  capacityHours,
  previousHref,
  nextHref,
  tabHref,
}: {
  organizationSelect: Child;
  month: string;
  report: ReportRows;
  total: Totals;
  currency: string;
  capacityHours: number;
  previousHref: string;
  nextHref: string;
  tabHref: (tab: Tab) => string;
}) {
  const table = reportTable(report, total, currency, capacityHours);
  return (
    <Page
      title="Reports"
      actions={
        <>
          {organizationSelect}
          <PeriodNavigation
            previousHref={previousHref}
            nextHref={nextHref}
            previousLabel="Previous month"
            nextLabel="Next month"
          >
            {formatMonth(month)}
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
        <div class="b-all bc-subtle br-l p-m">
          {table.rows.length === 0 ? (
            <EmptyState emoji="🗓️" title="No hours logged">
              No time was logged in {formatMonth(month)}.
            </EmptyState>
          ) : (
            <Table
              headings={table.headings}
              textColumns={table.textColumns ?? 1}
              rows={table.rows}
              footer={table.footer}
            />
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
): ReportTable {
  switch (report.tab) {
    case "clients":
      return {
        headings: ["Name", "Hours", "Billable hours", "Billable amount"],
        rows: report.rows.map((row) => [
          <span class="fw-medium">{row.name}</span>,
          formatTotal(row.hours),
          formatTotal(row.billableHours),
          formatAmount(row.amount, currency),
        ]),
        footer: [
          "Total",
          formatTotal(total.hours),
          formatTotal(total.billableHours),
          formatAmount(total.amount, currency),
        ],
      };
    case "projects":
      return {
        headings: ["Name", "Client", "Hours", "Billable hours", "Billable amount"],
        textColumns: 2,
        rows: report.rows.map((row) => [
          <span class="stack-v gap-4xs">
            <span class="fw-medium">{row.name}</span>
            <span class="fs-xs ink-subtle">{row.code}</span>
          </span>,
          row.client,
          formatTotal(row.hours),
          formatTotal(row.billableHours),
          formatAmount(row.amount, currency),
        ]),
        footer: [
          "Total",
          "",
          formatTotal(total.hours),
          formatTotal(total.billableHours),
          formatAmount(total.amount, currency),
        ],
      };
    case "consultants":
      return {
        headings: ["Name", "Hours", "Utilization", "Billable hours", "Billable amount"],
        rows: report.rows.map((row) => [
          <span class="fw-medium">{row.name}</span>,
          formatTotal(row.hours),
          formatShare(row.hours, capacityHours),
          <BillableHours hours={row.hours} billableHours={row.billableHours} />,
          formatAmount(row.amount, currency),
        ]),
        // Utilization has no total, since consultants who started or left mid-month skew any sum.
        footer: [
          "Total",
          formatTotal(total.hours),
          "",
          <BillableHours hours={total.hours} billableHours={total.billableHours} />,
          formatAmount(total.amount, currency),
        ],
      };
    case "tasks":
      return {
        headings: ["Name", "Billable hours", "Billable amount"],
        rows: report.rows.map((row) => [
          <span class="fw-medium">{row.name}</span>,
          formatTotal(row.billableHours),
          formatAmount(row.amount, currency),
        ]),
        footer: ["Total", formatTotal(total.billableHours), formatAmount(total.amount, currency)],
      };
  }
}

function Summary({
  hours,
  billableHours,
  amount,
  unratedHours,
  currency,
}: Totals & { currency: string }) {
  const nonBillableHours = hours - billableHours;

  return (
    <dl class="stack-h items-start gap-xl b-all bc-default br-l p-m t-tabular">
      <Stat label="Total" value={formatTotal(hours)} />
      <Stat
        label="Billable"
        value={formatTotal(billableHours)}
        share={formatShare(billableHours, hours)}
      />
      <Stat
        label="Non-billable"
        value={formatTotal(nonBillableHours)}
        share={formatShare(nonBillableHours, hours)}
      />
      <Stat
        label="Billable amount"
        value={formatAmount(amount, currency)}
        note={unratedHours > 0 ? `${formatTotal(unratedHours)} logged without a rate` : undefined}
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

/** Text columns share the spare width; the figures after them align right. */
function Table({
  headings,
  textColumns,
  rows,
  footer,
}: {
  headings: string[];
  textColumns: number;
  rows: Child[][];
  footer: Child[];
}) {
  const align = (index: number) => (index < textColumns ? "ta-left" : "ta-right");
  return (
    <div
      class="d-grid of-scroll gap-column-l lh-snug t-tabular"
      style={`grid-template-columns: repeat(${textColumns}, minmax(16ch, 1fr)) repeat(${headings.length - textColumns}, max-content);`}
    >
      <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs">
        {headings.map((label, index) => (
          <span class={`fs-s ink-subtle fw-bold ${align(index)}`}>{label}</span>
        ))}
      </div>
      {rows.map((cells) => (
        <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s">
          {cells.map((cell, index) => (
            <span class={align(index)}>{cell}</span>
          ))}
        </div>
      ))}
      <div class="grid-all-columns grid-subgrid items-center p-xs fs-s fw-medium">
        {footer.map((cell, index) => (
          <span class={align(index)}>{cell}</span>
        ))}
      </div>
    </div>
  );
}

function BillableHours({ hours, billableHours }: { hours: number; billableHours: number }) {
  return (
    <span class="stack-h nowrap justify-end gap-xs">
      {formatTotal(billableHours)}
      <span class="ink-subtle fw-regular">{formatShare(billableHours, hours)}</span>
    </span>
  );
}

/** Unlike a timesheet cell, an empty total still reads as zero. */
function formatTotal(hours: number) {
  return `${formatHours(Math.round(hours * 60)) || "0"} h`;
}
