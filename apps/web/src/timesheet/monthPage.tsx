import { type Calendar, calendarFor } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, daysOfMonth, isWeekend, mondayOf } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import type { SpecialDay } from "@tid/calendar/publicHolidays";
import { timeEntries } from "@tid/db/schema";
import { formatHours } from "@tid/elements/hours";
import { Button, ColorMode, Input, Label, Page, PeriodNavigation } from "@tid/ui";
import { and, between, eq } from "drizzle-orm";
import type { Context } from "hono";
import { css, cx } from "hono/css";
import type { PropsWithChildren } from "hono/jsx";
import { database } from "../database";
import { isLockedOn } from "../endOfTheMonth/monthLock";
import type { UserEnv } from "../login/user";
import { findOrganizationCountry } from "../organizations/organization";
import { loggableBy, type Task, userTasks } from "./loggableTasks";
import { type CellError, inputWidth, TimesheetCell } from "./timesheetCell";

type TimeEntry = { taskId: number; spentOn: string; minutes: number };
/** A failed save on the month, naming the cell to show it on. */
export type MonthError = CellError & { taskId: number; day: string };

/** The user's entries between from and till, and every task they may log on. */
async function loadTimesheet(userId: number, from: string, till: string) {
  const entries = await database
    .select({
      taskId: timeEntries.taskId,
      spentOn: timeEntries.spentOn,
      minutes: timeEntries.minutes,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), between(timeEntries.spentOn, from, till)));
  return { tasks: await userTasks().where(loggableBy(userId)), entries };
}
const addedTaskIdsOf = (queries: string[] | undefined) => (queries ?? []).map(Number);

export const monthPath = (month: string, showWeekends: boolean) =>
  `/timesheet/month/${month}${showWeekends ? "?weekends=on" : ""}`;

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
    monthDays[0] ?? "",
    monthDays.at(-1) ?? "",
  );
  // A weekend with hours stays visible, so hiding weekends never hides time.
  const days = monthDays.filter(
    (day) => showWeekends || !isWeekend(day) || entries.some((entry) => entry.spentOn === day),
  );
  const search = new URL(c.req.url).search;
  const country = await findOrganizationCountry(c.get("user").orgId);
  if (!country) throw new Error("The user's organization is missing");

  return c.render(
    <MonthPage
      month={month}
      locked={await isLockedOn(c.get("user").orgId, `${month}-01`)}
      showWeekends={showWeekends}
      previousHref={monthPath(addMonths(month, -1), showWeekends)}
      nextHref={monthPath(addMonths(month, 1), showWeekends)}
      days={days}
      calendar={calendarFor(country)}
      tasks={tasks}
      entries={entries}
      cellsAction={cellsActionOf(month, search)}
      cellAction={`/timesheet/month/${month}/cell${search}`}
      addedTaskIds={addedTaskIds}
      search={search}
      error={error}
    />,
  );
}

type TimesheetGridProps = {
  days: string[];
  calendar: Calendar;
  tasks: Task[];
  entries: TimeEntry[];
  cellsAction: string;
  addedTaskIds: number[];
  /** The current query string, kept when adding a row. */
  search: string;
  error?: MonthError;
  /** Locked months show their hours but take no changes. */
  locked?: boolean;
};

type PeriodLinks = { previousHref: string; nextHref: string };

function MonthPage({
  month,
  showWeekends,
  previousHref,
  nextHref,
  cellAction,
  ...grid
}: {
  month: string;
  showWeekends: boolean;
  /** Where the timesheet element saves a cell, getting just that cell back. */
  cellAction: string;
} & PeriodLinks &
  TimesheetGridProps) {
  return (
    <Page
      title="Timesheet"
      actions={
        <>
          <form method="get" class="stack-h nowrap items-center gap-2xs">
            {grid.addedTaskIds.map((taskId) => (
              <input type="hidden" name="add" value={taskId} />
            ))}
            {/* A plain input, since Checkbox's props don't allow an inline handler. */}
            <input
              type="checkbox"
              class="v-checkbox"
              id="weekends"
              name="weekends"
              value="on"
              checked={showWeekends}
              onchange="this.form.requestSubmit()"
            />
            <Label for="weekends">Show weekends</Label>
            <noscript>
              <Button type="submit" data-size="small">
                Apply
              </Button>
            </noscript>
          </form>
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
      <timesheet-conductor cell-action={cellAction}>
        <TimesheetGrid {...grid} />
      </timesheet-conductor>
    </Page>
  );
}

function TimesheetGrid({
  days,
  calendar,
  tasks,
  entries,
  cellsAction,
  addedTaskIds,
  search,
  error,
  locked = false,
}: TimesheetGridProps) {
  const today = todayInOslo();
  const holidays = days.map(calendar.holidayOn);
  const tints = days.map((day, index): DayTintKind | undefined =>
    day === today ? "today" : holidays[index] ? "holiday" : undefined,
  );
  // A week starts wherever the Monday changes, which still holds with weekends hidden.
  const startsWeek = days.map(
    (day, index) => index > 0 && mondayOf(day) !== mondayOf(days[index - 1] ?? day),
  );
  // Task stays put while the days scroll beneath it; the background hides what's under.
  const stickyStart = "pos-sticky left-0 surface-base mr-xs pr-2xs";
  const minutesOn = (taskId: number, day: string) =>
    entries.find((entry) => entry.taskId === taskId && entry.spentOn === day)?.minutes ?? 0;
  const sumMinutes = (predicate: (entry: (typeof entries)[number]) => boolean) =>
    entries.filter(predicate).reduce((total, entry) => total + entry.minutes, 0);

  // ponytail: added rows live only in the URL, so they vanish on navigation until they're stored.
  const rows = tasks
    .filter(
      (task) => addedTaskIds.includes(task.id) || entries.some((entry) => entry.taskId === task.id),
    )
    .sort(byProjectThenName);
  const addableByProject = Object.entries(
    Object.groupBy(
      tasks.filter((task) => !rows.includes(task)).sort(byProjectThenName),
      (task) => task.projectName,
    ),
  );
  const addable = !locked && addableByProject.length > 0;
  return (
    <>
      <div
        class={cx("d-grid of-scroll t-tabular my-s", sheetLayout)}
        style={`--days: ${days.length}; --task-columns: ${rows.length + (addable ? 1 : 0)};`}
      >
        <div class="grid-subgrid grid-all-columns fs-s">
          <div
            class={`py-xs ink-subtle  ${stickyStart}`}
            style="
            align-content: end;
        "
          >
            Task
          </div>
          {days.map((day, index) => (
            <DayTint
              tint={tints[index]}
              weekStart={startsWeek[index]}
              class={`ta-right fs-s py-xs px-3xs d-block  br-m br-bl-none br-br-none${tints[index] ? "" : " surface-base"}`}
            >
              {day === today && <span id="today" />}
              <DayLabel isToday={day === today} holiday={holidays[index]} />
              {formatDate(day, "day")}
            </DayTint>
          ))}
        </div>

        {rows.map((task) => (
          <div class="grid-subgrid grid-all-columns items-center ">
            <div class={`py-2xs self-stretch stack-v justify-center ${stickyStart}`}>
              <a href={`/projects/${task.projectId}`} class="stack-v">
                <span class="fs-s fw-medium lh-snug">{task.name}</span>
                <span class="fs-xs ink-subtle">{task.projectName}</span>
              </a>
            </div>
            {days.map((day, index) => (
              <DayTint
                tint={tints[index]}
                weekStart={startsWeek[index]}
                class="self-stretch px-3xs stack-v justify-center items-end"
              >
                <TimesheetCell
                  task={task}
                  day={day}
                  minutes={minutesOn(task.id, day)}
                  action={cellsAction}
                  error={error?.taskId === task.id && error.day === day ? error : undefined}
                  locked={locked}
                />
              </DayTint>
            ))}
          </div>
        ))}

        {addable && (
          // Picking a task adds `add` to the query, like the hidden inputs already there.
          <form method="get" class="grid-subgrid grid-all-columns items-center">
            {[...new URLSearchParams(search)].map(([name, value]) => (
              <input type="hidden" name={name} value={value} />
            ))}
            <div class={`py-2xs ${stickyStart}`}>
              {/* A plain select, since Select's props don't allow an inline handler. */}
              <select
                name="add"
                class="v-select w-full"
                data-size="small"
                aria-label="Add task"
                onchange="this.form.requestSubmit()"
              >
                <option value="" selected disabled>
                  Add task…
                </option>
                {addableByProject.map(([projectName, projectTasks]) => (
                  <optgroup label={projectName}>
                    {projectTasks?.map((task) => (
                      <option value={task.id}>{task.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <noscript>
                <Button type="submit" data-size="small">
                  Add
                </Button>
              </noscript>
            </div>
            {/* Placeholders so the row reads as part of the sheet; there's no task to log on yet. */}
            {days.map((day, index) => (
              <DayTint
                tint={tints[index]}
                weekStart={startsWeek[index]}
                class="self-stretch px-3xs stack-v justify-center items-end"
              >
                <Input
                  type="text"
                  disabled
                  tabindex={-1}
                  aria-hidden="true"
                  class="w-min-0 w-full"
                  data-size="small"
                  style={`max-width: ${inputWidth}`}
                />
              </DayTint>
            ))}
          </form>
        )}

        {rows.length > 0 && (
          <div class="grid-subgrid grid-all-columns fw-medium ta-right py-s fs-s">
            <div class={`ta-left ${stickyStart}`} style="align-content: end;">
              Total
            </div>
            {days.map((day, index) => (
              <div
                class="px-xs self-stretch stack-v justify-center surface-base"
                data-week-start={startsWeek[index] || undefined}
                data-day-total={day}
              >
                {formatHours(sumMinutes((entry) => entry.spentOn === day))}
              </div>
            ))}
          </div>
        )}
      </div>
      {rows.length > 0 && <ProjectTotals rows={rows} sumMinutes={sumMinutes} />}
    </>
  );
}

function ProjectTotals({
  rows,
  sumMinutes,
}: {
  rows: Task[];
  sumMinutes: (predicate: (entry: TimeEntry) => boolean) => number;
}) {
  const projects = Map.groupBy(rows, (task) => task.projectId);
  return (
    <section class="stack-v w-max-5 fs-s t-tabular">
      <h2 class="fs-m fw-medium mb-2xs">Project totals</h2>
      {[...projects].map(([projectId, tasks]) => {
        const taskIds = tasks.map((task) => task.id);
        return (
          <div class="stack-h justify-between gap-s py-2xs b-b bc-subtle">
            <a href={`/projects/${projectId}`}>{tasks[0]?.projectName}</a>
            <span data-project-total={projectId}>
              {formatHours(sumMinutes((entry) => taskIds.includes(entry.taskId)))}
            </span>
          </div>
        );
      })}
      <div class="stack-h justify-between gap-s py-2xs fw-medium">
        <span>Total</span>
        <span data-grand-total>{formatHours(sumMinutes(() => true))}</span>
      </div>
    </section>
  );
}

function byProjectThenName(a: Task, b: Task) {
  return a.projectName.localeCompare(b.projectName, "nb") || a.name.localeCompare(b.name, "nb");
}

type DayTintKind = "today" | "holiday";
const tintPalettes = { today: "blue", holiday: "orange" } as const;

function DayTint({
  tint,
  weekStart,
  class: className,
  children,
}: PropsWithChildren<{ tint?: DayTintKind; weekStart?: boolean; class: string }>) {
  const weekStartMark = weekStart || undefined;
  if (!tint)
    return (
      <div class={className} data-week-start={weekStartMark}>
        {children}
      </div>
    );
  return (
    <ColorMode
      palette={tintPalettes[tint]}
      class={`surface-tinted ${className}`}
      data-week-start={weekStartMark}
    >
      {children}
    </ColorMode>
  );
}

function DayLabel({ isToday, holiday }: { isToday: boolean; holiday?: SpecialDay }) {
  if (!isToday && !holiday) return null;
  return (
    // Widens the day's column up to the longest word in a holiday's name, and wraps beyond that.
    <span class={cx("d-block fs-xs fw-medium lh-snug mb-3xs", dayLabelLayout)}>
      {isToday && <span class="d-block">Today</span>}
      {holiday && (
        <span class="d-block">
          <span aria-hidden="true">{holiday.emoji}</span> {holiday.name}
        </span>
      )}
    </span>
  );
}

const dayLabelLayout = css`
  max-inline-size: 15ch;
  margin-inline-start: auto;
`;

/**
 * Phones log a day at a time, so there the sheet turns: each row becomes a column, with days
 * running down and tasks across. The markup and its look stay the desktop sheet's, so what sticks
 * to the start of a row sticks to the top of its column instead.
 */
const sheetLayout = css`
  grid-template-columns: minmax(20ch, 1fr) repeat(var(--days), max-content);
  & [data-week-start] {
    margin-inline-start: var(--spacing-xs);
  }
  /* A hidden target is no fragment target, so only phones jump to today. */
  & #today {
    display: none;
  }

  @media (width < 40rem) {
    /* Sticky only holds within the nearest scroll container, so the sheet scrolls both ways itself. */
    max-height: 85dvh;
    grid-auto-flow: column;
    grid-template-rows: auto repeat(var(--days), auto);
    grid-template-columns: max-content repeat(var(--task-columns), minmax(auto, 1fr)) max-content;
    & > * {
      display: contents;
    }
    /* Columns fit an input and the longest word of the name, and overflow sideways beyond that. */
    & > * > :first-child > :is(p:first-child, select) {
      min-inline-size: 10ch;
    }
    & [data-week-start] {
      margin-inline-start: 0;
      margin-block-start: var(--spacing-xs);
    }
    /* Padding rather than margin, so no gap shows what scrolls beneath. */
    & > * > :first-child {
      top: 0;
      left: auto;
      margin-inline-end: 0;
      padding-inline-end: var(--spacing-xs);
    }
    /* Days and their totals stay put while wide sheets scroll sideways. */
    & > :first-child > *,
    & > :last-child > * {
      position: sticky;
    }
    & > :first-child > * {
      left: 0;
    }
    & > :last-child > * {
      right: 0;
    }
    /* Corners cover the header and total rows, which cover the day columns, which cover cells. */
    & > :is(:first-child, :last-child) > * {
      z-index: 1;
    }
    & > * > :first-child {
      z-index: 2;
    }
    & > :is(:first-child, :last-child) > :first-child {
      z-index: 3;
    }
    & #today {
      display: inline;
      scroll-margin-block-start: 6lh;
    }
  }
`;
