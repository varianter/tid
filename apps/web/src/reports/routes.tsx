import { organizations, timeEntriesExport } from "@tid/db/schema";
import { Button, EmptyState, Page, PeriodNavigation } from "@tid/ui";
import { and, between, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Child } from "hono/jsx";
import { database } from "../database";
import {
  addMonths,
  daysOfMonth,
  formatHours,
  formatMonth,
  isWeekend,
  todayInOslo,
} from "../timesheet/dates";
import { reportQuery, type Tab, tabs } from "./period";

export const reports = new Hono();

// ponytail: everyone lands on Trondheim until we know which organization the user belongs to.
const defaultOrganization = "trondheim";

const reportPath = (organization: string, query: URLSearchParams) =>
  `/reports/${organization}?${query}`;

const tabLabels: Record<Tab, string> = {
  clients: "Clients",
  projects: "Projects",
  consultants: "Consultants",
  tasks: "Tasks",
};

reports.get("/", (c) =>
  c.redirect(
    reportPath(
      defaultOrganization,
      reportQuery(c.req.query("from"), c.req.query("tab"), todayInOslo()),
    ),
  ),
);

reports.get("/:organization", async (c) => {
  const slug = c.req.param("organization");
  const query = reportQuery(c.req.query("from"), c.req.query("tab"), todayInOslo());
  if (new URL(c.req.url).search !== `?${query}`) return c.redirect(reportPath(slug, query));

  const [organization] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug));
  if (!organization) return c.notFound();

  const from = query.get("from") ?? "";
  const till = query.get("till") ?? "";
  const tab = query.get("tab") as Tab;
  const month = from.slice(0, 7);
  const view = timeEntriesExport;
  const inReport = and(
    // ponytail: the view only exposes the organization's name; add its id if names collide.
    eq(view.accountName, organization.name),
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
  // ponytail: capacity counts every weekday as a full day; subtract holidays and leave once we store them.
  const capacityHours =
    (daysOfMonth(month).filter((day) => !isWeekend(day)).length * organization.fullDayMinutes) / 60;

  const table = await (async (): Promise<ReportTable> => {
    switch (tab) {
      case "clients": {
        const rows = await database
          .select({ name: view.clientName, ...totals })
          .from(view)
          .where(inReport)
          .groupBy(view.clientName)
          .orderBy(view.clientName);
        return {
          headings: ["Name", "Hours", "Billable hours", "Billable amount"],
          rows: rows.map((row) => ({
            totals: row,
            cells: [
              <span class="fw-medium">{row.name}</span>,
              formatTotal(row.hours),
              formatTotal(row.billableHours),
              formatAmount(row.amount, currency),
            ],
          })),
          footer: (total) => [
            "Total",
            formatTotal(total.hours),
            formatTotal(total.billableHours),
            formatAmount(total.amount, currency),
          ],
        };
      }
      case "projects": {
        const rows = await database
          .select({
            code: view.projectCode,
            name: view.projectName,
            client: view.clientName,
            ...totals,
          })
          .from(view)
          .where(inReport)
          .groupBy(view.projectCode, view.projectName, view.clientName)
          .orderBy(view.projectName);
        return {
          headings: ["Name", "Client", "Hours", "Billable hours", "Billable amount"],
          textColumns: 2,
          rows: rows.map((row) => ({
            totals: row,
            cells: [
              <span class="stack-v gap-4xs">
                <span class="fw-medium">{row.name}</span>
                <span class="fs-xs ink-subtle">{row.code}</span>
              </span>,
              row.client,
              formatTotal(row.hours),
              formatTotal(row.billableHours),
              formatAmount(row.amount, currency),
            ],
          })),
          footer: (total) => [
            "Total",
            "",
            formatTotal(total.hours),
            formatTotal(total.billableHours),
            formatAmount(total.amount, currency),
          ],
        };
      }
      case "consultants": {
        const rows = await database
          .select({ email: view.userEmail, name: view.userName, ...totals })
          .from(view)
          .where(inReport)
          .groupBy(view.userEmail, view.userName)
          .orderBy(view.userName);
        return {
          headings: ["Name", "Hours", "Utilization", "Billable hours", "Billable amount"],
          rows: rows.map((row) => ({
            totals: row,
            cells: [
              <span class="fw-medium">{row.name}</span>,
              formatTotal(row.hours),
              formatShare(row.hours, capacityHours),
              <BillableHours hours={row.hours} billableHours={row.billableHours} />,
              formatAmount(row.amount, currency),
            ],
          })),
          // Utilization has no total, since consultants who started or left mid-month skew any sum.
          footer: (total) => [
            "Total",
            formatTotal(total.hours),
            "",
            <BillableHours hours={total.hours} billableHours={total.billableHours} />,
            formatAmount(total.amount, currency),
          ],
        };
      }
      case "tasks": {
        const rows = await database
          .select({ name: view.taskName, ...totals })
          .from(view)
          .where(inReport)
          .groupBy(view.taskName)
          .orderBy(view.taskName);
        return {
          headings: ["Name", "Billable hours", "Billable amount"],
          rows: rows.map((row) => ({
            totals: row,
            cells: [
              <span class="fw-medium">{row.name}</span>,
              formatTotal(row.billableHours),
              formatAmount(row.amount, currency),
            ],
          })),
          footer: (total) => [
            "Total",
            formatTotal(total.billableHours),
            formatAmount(total.amount, currency),
          ],
        };
      }
    }
  })();

  // Every tab groups the same entries, so its rows add up to the whole report.
  const sumOf = (field: keyof Totals) =>
    table.rows.reduce((total, row) => total + row.totals[field], 0);
  const total: Totals = {
    hours: sumOf("hours"),
    billableHours: sumOf("billableHours"),
    amount: sumOf("amount"),
    unratedHours: sumOf("unratedHours"),
  };
  const monthPath = (months: number) =>
    reportPath(slug, reportQuery(`${addMonths(month, months)}-01`, tab, todayInOslo()));

  return c.render(
    <Page
      title="Reports"
      actions={
        <>
          <Button type="button" data-variant="tinted">
            New report
          </Button>
          <PeriodNavigation
            previousHref={monthPath(-1)}
            nextHref={monthPath(1)}
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
        <nav aria-label="Group by" class="stack-h gap-4xs" style="margin-bottom: -1px;">
          {tabs.map((tabName) => (
            <Button
              as="a"
              href={reportPath(slug, reportQuery(from, tabName, todayInOslo()))}
              aria-current={tabName === tab ? "page" : undefined}
              class="br-bl-none br-br-none"
              data-size="small"
              data-variant={tabName === tab ? undefined : "plain"}
            >
              {tabLabels[tabName]}
            </Button>
          ))}
        </nav>
        <div class="b-all bc-subtle br-l br-tl-none p-m">
          {table.rows.length === 0 ? (
            <EmptyState emoji="🗓️" title="No hours logged">
              No time was logged in {formatMonth(month)}.
            </EmptyState>
          ) : (
            <Table
              headings={table.headings}
              textColumns={table.textColumns ?? 1}
              rows={table.rows.map((row) => row.cells)}
              footer={table.footer(total)}
            />
          )}
        </div>
      </section>
    </Page>,
  );
});

type Totals = { hours: number; billableHours: number; amount: number; unratedHours: number };
type ReportTable = {
  headings: string[];
  /** How many leading columns hold text rather than figures. */
  textColumns?: number;
  rows: { totals: Totals; cells: Child[] }[];
  footer: (total: Totals) => Child[];
};

const percentFormat = new Intl.NumberFormat("nb-NO", { style: "percent" });

/** Blank when there's nothing to take a share of, rather than NaN or Infinity. */
function formatShare(part: number, whole: number) {
  return whole === 0 ? "" : percentFormat.format(part / whole);
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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
