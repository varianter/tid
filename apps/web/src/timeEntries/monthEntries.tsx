import { formatDate } from "@tid/calendar/dateDisplay";
import { formatTotalHours } from "@tid/elements/hours";
import { DataGrid, Section } from "@tid/ui";

/** A time entry, titled by whatever the list isn't already about: its project, or who logged it. */
export type MonthEntry = {
  spentOn: string;
  minutes: number;
  notes: string | null;
  task: string;
  title: string;
  subtitle?: string;
};

/** A month's time entries under a heading per day, newest first as given. */
export function MonthEntries({
  month,
  entries,
  titleLabel,
}: {
  month: string;
  entries: MonthEntry[];
  /** What the first column holds, such as "Project". */
  titleLabel: string;
}) {
  const days = Map.groupBy(entries, (entry) => entry.spentOn);
  return (
    <Section title="Entries" class="flex-1">
      {days.size === 0 ? (
        <p class="ink-subtle">No time was logged in {formatDate(month, "month")}.</p>
      ) : (
        <DataGrid
          columns={[{ label: titleLabel }, { label: "Task" }, { label: "Hours", kind: "number" }]}
        >
          {[...days].map(([day, dayEntries]) => (
            <>
              <DataGrid.Group>
                <span class="stack-h">
                  <span class="flex-1">{formatDate(day)}</span>
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
      )}
    </Section>
  );
}
