import { Button, EmptyState, Page, PeriodNavigation } from "@tid/ui";
import type { Child } from "hono/jsx";
import { formatHours, formatMonth } from "../dates/dates";
import { type Tab, tabs } from "./period";

export type Totals = { hours: number; billableHours: number; amount: number; unratedHours: number };

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

export function ReportPage({
  month,
  report,
  total,
  currency,
  capacityHours,
  previousHref,
  nextHref,
  tabHref,
}: {
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
          <Button type="button" data-variant="tinted">
            New report
          </Button>
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
        <nav aria-label="Group by" class="stack-h gap-4xs" style="margin-bottom: -1px;">
          {tabs.map((tabName) => (
            <Button
              as="a"
              href={tabHref(tabName)}
              aria-current={tabName === report.tab ? "page" : undefined}
              class="br-bl-none br-br-none"
              data-size="small"
              data-variant={tabName === report.tab ? undefined : "plain"}
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
