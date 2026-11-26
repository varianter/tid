import { formatDate, formatMonth } from "@tid/calendar/dateDisplay";
import { formatTotalHours } from "@tid/elements/hours";
import { DataGrid } from "@tid/ui";

/** A time entry, titled by whatever the list isn't already about: its project, or who logged it. */
export type MonthEntry = {
  spentOn: Temporal.PlainDate;
  minutes: number;
  notes: string | null;
  task: string;
  title: string;
  subtitle?: string;
};

/** A month's time entries grouped by day, newest first as given. The page gives it its heading. */
export function MonthEntries({
  month,
  entries,
  titleLabel,
}: {
  month: Temporal.PlainYearMonth;
  entries: MonthEntry[];
  /** What the first column holds, such as "Project". */
  titleLabel: string;
}) {
  // Keyed by text, since two Temporal values for the same day are different objects.
  const days = Map.groupBy(entries, (entry) => entry.spentOn.toString());
  return days.size === 0 ? (
    <p class="ink-subtle">No time was logged in {formatMonth(month)}.</p>
  ) : (
    <DataGrid
      columns={[{ label: titleLabel }, { label: "Task" }, { label: "Hours", kind: "number" }]}
    >
      {[...days].map(([day, dayEntries]) => (
        <>
          <DataGrid.Group>
            <span class="stack-h">
              <span class="flex-1">{formatDate(Temporal.PlainDate.from(day))}</span>
              {formatTotalHours(dayEntries.reduce((sum, entry) => sum + entry.minutes, 0))}
            </span>
          </DataGrid.Group>
          {dayEntries.map((entry) => (
            <DataGrid.Row>
              <DataGrid.Title secondary={entry.subtitle}>{entry.title}</DataGrid.Title>
              <span class="stack-v gap-4xs">
                {entry.task}
                {entry.notes && <span class="fs-xs ink-subtle">{entry.notes}</span>}
              </span>
              {formatTotalHours(entry.minutes)}
            </DataGrid.Row>
          ))}
        </>
      ))}
    </DataGrid>
  );
}
