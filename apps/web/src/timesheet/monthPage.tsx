import { calendarFor } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, daysOfMonth, isWeekend } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import { Checkbox, Label, Page, PeriodNavigation } from "@tid/ui";
import { capacityMinutes } from "../domain/capacity/capacity";
import type { User } from "../domain/users/user";
import { Filtered, FilterForm, PageSearch } from "../framework/filter";
import { CellShortcuts } from "./cellShortcuts";
import { ShowBillableAssignmentsForm } from "./showBillableAssignments.form";
import { cellsActionOf, monthPath } from "./timesheet.url";
import { type MonthError, TimesheetGrid, type TimesheetGridProps } from "./timesheetGrid";

type Timesheet = Pick<TimesheetGridProps, "tasks" | "entries" | "assignedTaskIds"> & {
  locked: boolean;
};

/** The month as the page's query asks for it, with one cell showing an error if a save failed. */
export function MonthPage({
  month,
  user,
  search,
  timesheet: { tasks, entries, assignedTaskIds, locked },
  showBillableAssignments,
  error,
}: {
  month: string;
  user: User;
  /** The page's query string, kept by its links and forms. */
  search: string;
  showBillableAssignments: boolean;
  timesheet: Timesheet;
  error?: MonthError;
}) {
  const query = new URLSearchParams(search);
  const showWeekends = query.get("weekends") === "on";
  // A weekend with hours stays visible, so hiding weekends never hides time.
  const days = daysOfMonth(month).filter(
    (day) => showWeekends || !isWeekend(day) || entries.some((entry) => entry.spentOn === day),
  );
  const { country, fullDayMinutes } = user.organization;
  return (
    <PageSearch.Provider value={query}>
      <Page title="Timesheet">
        <Filtered
          by={
            <>
              <FilterForm field="weekends">
                <Label for="weekends" class="stack-h items-center gap-2xs">
                  <Checkbox id="weekends" name="weekends" value="on" checked={showWeekends} />
                  Show weekends
                </Label>
              </FilterForm>
              <ShowBillableAssignmentsForm
                month={month}
                search={search}
                shown={showBillableAssignments}
              />
              <PeriodNavigation
                previousHref={monthPath(addMonths(month, -1), showWeekends)}
                nextHref={monthPath(addMonths(month, 1), showWeekends)}
                previousLabel="Previous month"
                nextLabel="Next month"
              >
                {formatDate(month, "month")}
              </PeriodNavigation>
            </>
          }
        >
          {locked && (
            <p class="b-all bc-subtle br-l fs-s p-xs surface-tinted">
              {formatDate(month, "month")} is locked. Ask a manager to unlock it if something needs
              changing.
            </p>
          )}
          <timesheet-conductor
            cell-action={`/timesheet/month/${month}/cell${search}`}
            full-day-minutes={fullDayMinutes}
            today={todayInOslo()}
          >
            <TimesheetGrid
              days={days}
              calendar={calendarFor(country)}
              expectedMinutes={capacityMinutes(month, country, fullDayMinutes, user.endsOn)}
              tasks={tasks}
              entries={entries}
              cellsAction={cellsActionOf(month, search)}
              addedTaskIds={query.getAll("add").map(Number)}
              assignedTaskIds={assignedTaskIds}
              error={error}
              locked={locked}
            />
          </timesheet-conductor>
          {!locked && <CellShortcuts fullDayMinutes={fullDayMinutes} />}
        </Filtered>
      </Page>
    </PageSearch.Provider>
  );
}
