import type { Calendar } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import { mondayOf } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import type { SpecialDay } from "@tid/calendar/publicHolidays";
import { formatHours } from "@tid/elements/hours";
import { Button, ColorMode, EmptyState, Select } from "@tid/ui";
import { cx } from "hono/css";
import type { PropsWithChildren } from "hono/jsx";
import { usePageSearch } from "../query/filter";
import type { Task } from "./loggableTasks";
import { ProjectTotals } from "./projectTotals";
import { dayLabelLayout, sheetLayout } from "./sheetLayout";
import { type CellError, TimesheetCell } from "./timesheetCell";

type TimeEntry = { taskId: number; spentOn: string; minutes: number };
/** A failed save on the month, naming the cell to show it on. */
export type MonthError = CellError & { taskId: number; day: string };

export type TimesheetGridProps = {
  days: string[];
  calendar: Calendar;
  /** What the consultant should log this month, so the totals can show how far they've come. */
  expectedMinutes: number;
  tasks: Task[];
  entries: TimeEntry[];
  cellsAction: string;
  addedTaskIds: number[];
  /** Tasks shown even without hours, since the user is assigned to their project. */
  assignedTaskIds: number[];
  error?: MonthError;
  /** Locked months show their hours but take no changes. */
  locked?: boolean;
};

export function TimesheetGrid({
  days,
  calendar,
  expectedMinutes,
  tasks,
  entries,
  cellsAction,
  addedTaskIds,
  assignedTaskIds,
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
      (task) =>
        addedTaskIds.includes(task.id) ||
        assignedTaskIds.includes(task.id) ||
        entries.some((entry) => entry.taskId === task.id),
    )
    .sort(byProjectThenName);
  const addableTasks = tasks.filter((task) => !rows.includes(task)).sort(byProjectThenName);
  const addable = !locked && addableTasks.length > 0;
  if (rows.length === 0) return <NoRows locked={locked} addableTasks={addableTasks} />;
  return (
    <>
      {addable && <AddTaskForm addableTasks={addableTasks} class="mt-s mb-m" />}
      <div
        class={cx("d-grid t-tabular my-s gap-column-3xs pr-m", sheetLayout)}
        style={`--days: ${days.length}; --task-columns: ${rows.length};`}
      >
        <div class="grid-subgrid grid-all-columns fs-s">
          <div
            data-task
            class={`py-xs ink-subtle  ${stickyStart}`}
            style="
            align-content: end;
        "
          >
            Task
          </div>
          {days.map((day, index) => (
            <DayTint
              id={day === today ? "today" : undefined}
              tint={tints[index]}
              weekStart={startsWeek[index]}
              class={`ta-right fs-s py-xs px-3xs stack-v justify-end items-end br-m br-bl-none br-br-none${tints[index] ? "" : " surface-base"}`}
            >
              <DayLabel isToday={day === today} holiday={holidays[index]} />
              {formatDate(day, "day")}
            </DayTint>
          ))}
        </div>

        {rows.map((task) => (
          <div class="grid-subgrid grid-all-columns items-center">
            <div data-task class={`py-2xs self-stretch stack-v justify-center ${stickyStart}`}>
              <a href={`/projects/${task.projectId}`} class="stack-v">
                <span class="fs-s fw-medium lh-snug">{task.name}</span>
                <span class="fs-xs ink-subtle">{task.projectName}</span>
              </a>
            </div>
            {days.map((day, index) => (
              <DayTint
                tint={tints[index]}
                weekStart={startsWeek[index]}
                class="py-3xs px-3xs stack-v justify-center items-end"
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

        {rows.length > 0 && (
          <div data-totals class="grid-subgrid grid-all-columns fw-medium ta-right py-s fs-s">
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
      <ProjectTotals rows={rows} sumMinutes={sumMinutes} expectedMinutes={expectedMinutes} />
    </>
  );
}

function NoRows({ locked, addableTasks }: { locked: boolean; addableTasks: Task[] }) {
  if (locked) return <EmptyState emoji="🔒" title="This month has left the building" />;
  if (addableTasks.length === 0)
    return (
      <EmptyState emoji="🏝️" title="Technically, you're on a desert island">
        Nowhere to put your hours – yet. Yell, DM or smoke signal someone who can make that happend.
      </EmptyState>
    );
  return (
    <EmptyState
      emoji="🦗🦗🦗"
      title="Pick a task, log some hours"
      action={<AddTaskForm addableTasks={addableTasks} />}
    >
      Preferably before the higher ups starts asking silly questions.
    </EmptyState>
  );
}

// Picking a task adds `add` to the page's query, next to the rows added before it. It isn't a
// filter, since it keeps every value already there.
function AddTaskForm({ addableTasks, class: className }: { addableTasks: Task[]; class?: string }) {
  return (
    <auto-submit>
      <form method="get" class={cx("stack-h nowrap items-center gap-2xs w-max-5", className)}>
        {[...usePageSearch()].map(([name, value]) => (
          <input type="hidden" name={name} value={value} />
        ))}
        <Select
          name="add"
          class="w-full"
          data-size="small"
          aria-label="Add task"
          options={addableTasks.map((task) => ({
            value: task.id,
            label: task.name,
            group: task.projectName,
          }))}
        >
          <option value="" selected disabled>
            Add task…
          </option>
        </Select>
        <noscript>
          <Button type="submit" data-size="small">
            Add
          </Button>
        </noscript>
      </form>
    </auto-submit>
  );
}

function byProjectThenName(a: Task, b: Task) {
  return a.projectName.localeCompare(b.projectName, "nb") || a.name.localeCompare(b.name, "nb");
}

type DayTintKind = "today" | "holiday";
const tintPalettes = { today: "blue", holiday: "orange" } as const;

function DayTint({
  id,
  tint,
  weekStart,
  class: className,
  children,
}: PropsWithChildren<{ id?: string; tint?: DayTintKind; weekStart?: boolean; class: string }>) {
  const weekStartMark = weekStart || undefined;
  if (!tint)
    return (
      <div id={id} class={className} data-week-start={weekStartMark}>
        {children}
      </div>
    );
  return (
    <ColorMode
      id={id}
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
