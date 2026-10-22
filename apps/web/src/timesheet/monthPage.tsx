import { calendarFor } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import {
  addMonths,
  daysOfMonth,
  firstDayOfMonth,
  isWeekend,
  lastDayOfMonth,
} from "@tid/calendar/isoDate";
import { thisMonthInOslo, todayInOslo } from "@tid/calendar/osloClock";
import { timeEntries } from "@tid/db/schema";
import { Button, Checkbox, Label, Page, PeriodNavigation } from "@tid/ui";
import { and, between, eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { isLockedOn } from "../monthClose/monthLock.data";
import { findOrganization } from "../organizations/organization";
import { capacityMinutes } from "../reports/capacity";
import { CellShortcuts } from "./cellShortcuts";
import { offeredTo, userTasks } from "./loggableTasks";
import { type MonthError, TimesheetGrid, type TimesheetGridProps } from "./timesheetGrid";

/** The user's entries between from and till, and the tasks the timesheet offers them. */
async function loadTimesheet(userId: number, from: string, till: string) {
  const entries = await database
    .select({
      taskId: timeEntries.taskId,
      spentOn: timeEntries.spentOn,
      minutes: timeEntries.minutes,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), between(timeEntries.spentOn, from, till)));
  return { tasks: await userTasks().where(offeredTo(userId, from, till)), entries };
}
const addedTaskIdsOf = (queries: string[] | undefined) => (queries ?? []).map(Number);

// The current month opens on today, wherever the link comes from.
export const monthPath = (month: string, showWeekends: boolean) =>
  `/timesheet/month/${month}${showWeekends ? "?weekends=on" : ""}${month === thisMonthInOslo() ? "#today" : ""}`;

// The query rides along, so a save can return to the same view.
export const cellsActionOf = (month: string, search: string) =>
  `/timesheet/month/${month}/cells${search}`;

/** Renders the month the request names, with one cell showing an error if a save failed. */
export async function renderMonth(c: Context<UserEnv>, month: string, error?: MonthError) {
  const showWeekends = c.req.query("weekends") === "on";
  const addedTaskIds = addedTaskIdsOf(c.req.queries("add"));
  const monthDays = daysOfMonth(month);
  const { tasks, entries } = await loadTimesheet(
    c.get("user").id,
    firstDayOfMonth(month),
    lastDayOfMonth(month),
  );
  // A weekend with hours stays visible, so hiding weekends never hides time.
  const days = monthDays.filter(
    (day) => showWeekends || !isWeekend(day) || entries.some((entry) => entry.spentOn === day),
  );
  const search = new URL(c.req.url).search;
  const user = c.get("user");
  const organization = await findOrganization(user.orgId);
  if (!organization) throw new Error("The user's organization is missing");
  const { country, fullDayMinutes } = organization;

  return c.render(
    <MonthPage
      month={month}
      locked={await isLockedOn(c.get("user").orgId, firstDayOfMonth(month))}
      showWeekends={showWeekends}
      previousHref={monthPath(addMonths(month, -1), showWeekends)}
      nextHref={monthPath(addMonths(month, 1), showWeekends)}
      days={days}
      calendar={calendarFor(country)}
      expectedMinutes={capacityMinutes(month, country, fullDayMinutes, user.endsOn)}
      tasks={tasks}
      entries={entries}
      cellsAction={cellsActionOf(month, search)}
      cellAction={`/timesheet/month/${month}/cell${search}`}
      fullDayMinutes={fullDayMinutes}
      addedTaskIds={addedTaskIds}
      search={search}
      error={error}
    />,
  );
}

type PeriodLinks = { previousHref: string; nextHref: string };

function MonthPage({
  month,
  showWeekends,
  previousHref,
  nextHref,
  cellAction,
  fullDayMinutes,
  ...grid
}: {
  month: string;
  showWeekends: boolean;
  /** Where the timesheet element saves a cell, getting just that cell back. */
  cellAction: string;
  /** What F fills a cell with. */
  fullDayMinutes: number;
} & PeriodLinks &
  TimesheetGridProps) {
  return (
    <Page
      title="Timesheet"
      actions={
        <>
          {!grid.locked && <CellShortcuts fullDayMinutes={fullDayMinutes} />}
          <auto-submit style="display: contents;">
            <form method="get" class="stack-h nowrap items-center gap-2xs">
              {grid.addedTaskIds.map((taskId) => (
                <input type="hidden" name="add" value={taskId} />
              ))}
              <Checkbox id="weekends" name="weekends" value="on" checked={showWeekends} />
              <Label for="weekends">Show weekends</Label>
              <noscript>
                <Button type="submit" data-size="small">
                  Show
                </Button>
              </noscript>
            </form>
          </auto-submit>
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
      {grid.locked && (
        <p class="b-all bc-subtle br-l fs-s p-xs surface-tinted">
          {formatDate(month, "month")} is locked. Ask a manager to unlock it if something needs
          changing.
        </p>
      )}
      <timesheet-conductor
        cell-action={cellAction}
        full-day-minutes={fullDayMinutes}
        today={todayInOslo()}
      >
        <TimesheetGrid {...grid} />
      </timesheet-conductor>
    </Page>
  );
}
