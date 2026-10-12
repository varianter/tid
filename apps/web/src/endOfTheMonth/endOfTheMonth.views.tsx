import { Button, Page, PeriodNavigation } from "@tid/ui";
import { formatHours, formatMonth, formatTimestamp } from "../dates/dates";

type ConsultantRow = {
  name: string;
  minutes: number;
  billableMinutes: number;
  expectedMinutes: number;
  missingMinutes: number;
};

export function EndOfTheMonthPage({
  organizationName,
  month,
  rows,
  activeLock,
  canChangeLock,
  lockAction,
  unlockAction,
  previousHref,
  nextHref,
}: {
  organizationName: string;
  month: string;
  rows: ConsultantRow[];
  activeLock?: { lockedAt: Date; lockedByName: string };
  canChangeLock: boolean;
  lockAction: string;
  unlockAction: string;
  previousHref: string;
  nextHref: string;
}) {
  return (
    <Page
      title={`End of the month · ${organizationName}`}
      actions={
        <PeriodNavigation
          previousHref={previousHref}
          nextHref={nextHref}
          previousLabel="Previous month"
          nextLabel="Next month"
        >
          {formatMonth(month)}
        </PeriodNavigation>
      }
    >
      <section class="stack-h items-center gap-m b-all bc-default br-l py-xs px-m">
        <span class={activeLock ? "fw-medium" : "ink-subtle"}>
          {activeLock
            ? `Locked by ${activeLock.lockedByName}, ${formatTimestamp(activeLock.lockedAt)}`
            : `${formatMonth(month)} is open`}
        </span>
        {canChangeLock && (
          <form method="post" action={activeLock ? unlockAction : lockAction} class="ml-auto">
            <Button type="submit" data-variant={activeLock ? undefined : "tinted"}>
              {activeLock ? "Unlock this month" : `Lock this month`}
            </Button>
          </form>
        )}
      </section>
      <ConsultantTable
        title="Still missing hours"
        showMissing
        rows={rows
          .filter((row) => row.missingMinutes > 0)
          .sort((a, b) => b.missingMinutes - a.missingMinutes)}
      />
      <ConsultantTable
        title="All hours logged"
        rows={rows.filter((row) => row.missingMinutes === 0)}
      />
    </Page>
  );
}

function ConsultantTable({
  title,
  rows,
  showMissing = false,
}: {
  title: string;
  rows: ConsultantRow[];
  showMissing?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section class="stack-v gap-s">
      <h2 class="fs-l fw-bold">{title}</h2>
      <div
        class="d-grid of-scroll gap-column-l lh-snug t-tabular"
        style={`grid-template-columns: minmax(16ch, 1fr) repeat(${showMissing ? 4 : 3}, max-content);`}
      >
        <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
          <span>Consultant</span>
          <span class="ta-right">Logged</span>
          <span class="ta-right">Billable</span>
          <span class="ta-right">Expected</span>
          {showMissing && <span class="ta-right">Missing</span>}
        </div>
        {rows.map((row) => (
          <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s">
            <span class="fw-medium">{row.name}</span>
            <span class="ta-right">{formatTotal(row.minutes)}</span>
            <span class="ta-right">{formatShare(row.billableMinutes, row.minutes)}</span>
            <span class="ta-right ink-subtle">{formatTotal(row.expectedMinutes)}</span>
            {showMissing && <span class="ta-right">{formatTotal(row.missingMinutes)}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

const percentFormat = new Intl.NumberFormat("nb-NO", { style: "percent" });

/** Blank when nothing is logged, rather than NaN. */
function formatShare(part: number, whole: number) {
  return whole === 0 ? "" : percentFormat.format(part / whole);
}

/** Unlike a timesheet cell, an empty total still reads as zero. */
function formatTotal(minutes: number) {
  return `${formatHours(minutes) || "0"} h`;
}
