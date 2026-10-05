import { Button, Input, Label, Page, PeriodNavigation, Popover } from "@tid/ui";
import type { PropsWithChildren } from "hono/jsx";
import {
  formatDayMonth,
  formatHours,
  formatMonth,
  formatWeekday,
  mondayOf,
  todayInOslo,
} from "../dates/dates";

type Task = { id: number; name: string; projectName: string };
type TimeEntry = { taskId: number; spentOn: string; minutes: number };
/** A save that failed, shown on its cell with what the user typed. */
export type CellError = { taskId: number; day: string; typed: string; message: string };

// Caps the inputs, which in turn size the day columns.
const inputWidth = "8ch";

type TimesheetGridProps = {
  days: string[];
  tasks: Task[];
  entries: TimeEntry[];
  cellsAction: string;
  addedTaskIds: number[];
  /** The current query string, kept when adding a row. */
  search: string;
  error?: CellError;
};

type PeriodLinks = { previousHref: string; nextHref: string };

export function MonthPage({
  month,
  showWeekends,
  previousHref,
  nextHref,
  ...grid
}: { month: string; showWeekends: boolean } & PeriodLinks & TimesheetGridProps) {
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
            {formatMonth(month)}
          </PeriodNavigation>
        </>
      }
    >
      <TimesheetGrid {...grid} />
    </Page>
  );
}

function TimesheetGrid({
  days,
  tasks,
  entries,
  cellsAction,
  addedTaskIds,
  search,
  error,
}: TimesheetGridProps) {
  const today = todayInOslo();
  // A week starts wherever the Monday changes, which still holds with weekends hidden.
  const startsWeek = days.map(
    (day, index) => index > 0 && mondayOf(day) !== mondayOf(days[index - 1] ?? day),
  );
  const weekGap = (index: number) => (startsWeek[index] ? " ml-xs" : "");
  // Task and Total stay put while the days scroll beneath them; the background hides what's under.
  const stickyStart = "pos-sticky left-0 surface-base mr-xs pr-2xs";
  const stickyEnd = "pos-sticky right-0 surface-base pl-xs pr-2xs";
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
  return (
    <div
      class="d-grid of-scroll t-tabular my-s"
      style={`grid-template-columns: minmax(20ch, 1fr) repeat(${days.length}, max-content) max-content;`}
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
          <TodayTint
            isToday={day === today}
            class={`ta-right fs-s py-xs px-3xs d-block b-b bc-subtle br-m br-bl-none br-br-none${weekGap(index)}`}
          >
            <div class="ink-subtle">{formatWeekday(day)}</div>
            <div class="ink-prominent">{formatDayMonth(day)}</div>
          </TodayTint>
        ))}
        <div class={`ta-right py-xs ink-subtle ${stickyEnd}`}>Total</div>
      </div>

      {rows.map((task) => (
        <div class="grid-subgrid grid-all-columns items-center ">
          <div class={`py-2xs self-stretch stack-v justify-center ${stickyStart}`}>
            <p class="fs-s fw-medium lh-snug">{task.name}</p>
            <p class="fs-xs ink-subtle">{task.projectName}</p>
          </div>
          {days.map((day, index) => (
            <TodayTint
              isToday={day === today}
              class={`self-stretch px-3xs stack-v justify-center ${weekGap(index)}`}
            >
              <TimesheetCell
                task={task}
                day={day}
                minutes={minutesOn(task.id, day)}
                action={cellsAction}
                error={error?.taskId === task.id && error.day === day ? error : undefined}
              />
            </TodayTint>
          ))}
          <div
            class={`ta-right fw-medium self-stretch stack-v justify-center ${stickyEnd} fs-s`}
            data-task-total={task.id}
          >
            {formatHours(sumMinutes((entry) => entry.taskId === task.id))}
          </div>
        </div>
      ))}

      {addableByProject.length > 0 && (
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
            <TodayTint
              isToday={day === today}
              class={`self-stretch px-3xs stack-v justify-center${weekGap(index)}`}
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
            </TodayTint>
          ))}
          <div class={`self-stretch ${stickyEnd}`} />
        </form>
      )}

      {rows.length > 0 && (
        <div class="grid-subgrid grid-all-columns fw-medium ta-right py-s fs-s">
          <div class={`ta-left ${stickyStart}`}>Total</div>
          {days.map((day, index) => (
            <div class={`px-xs${weekGap(index)}`} data-day-total={day}>
              {formatHours(sumMinutes((entry) => entry.spentOn === day))}
            </div>
          ))}
          <div class={stickyEnd} data-grand-total>
            {formatHours(sumMinutes(() => true))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One day of one task: the unit a save swaps. `data-minutes` holds what's stored,
 * so totals can be summed without parsing the typed text.
 */
export function TimesheetCell({
  task,
  day,
  minutes,
  action,
  error,
}: {
  task: Task;
  day: string;
  minutes: number;
  action: string;
  error?: CellError;
}) {
  const errorId = `cell-error-${task.id}-${day}`;
  const input = (
    <Input
      name="hours"
      type="text"
      value={error ? error.typed : formatHours(minutes)}
      class="ta-right w-min-0 w-full"
      data-size="small"
      style={`max-width: ${inputWidth}`}
      inputmode="decimal"
      aria-label={`${task.projectName}, ${task.name}, ${formatWeekday(day)} ${day}`}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? errorId : undefined}
    />
  );
  return (
    <form
      method="post"
      action={action}
      class="d-block"
      data-task={task.id}
      data-day={day}
      data-minutes={minutes}
    >
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="date" value={day} />
      {error ? (
        <color-mode palette="coral" class="stack-h nowrap items-center gap-3xs">
          {input}
          <button
            type="button"
            popovertarget={errorId}
            aria-label="Show error"
            class="ink-prominent"
          >
            <ErrorIcon />
          </button>
          <Popover id={errorId} data-type="tooltip" class="px-2xs py-2xs">
            <div class="b-all bc-subtle px-xs py-2xs surface-base br-m shadow-mid fs-s">
              {error.message}
            </div>
          </Popover>
        </color-mode>
      ) : (
        input
      )}
    </form>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function byProjectThenName(a: Task, b: Task) {
  return a.projectName.localeCompare(b.projectName, "nb") || a.name.localeCompare(b.name, "nb");
}

function TodayTint({
  isToday,
  class: className,
  children,
}: PropsWithChildren<{ isToday: boolean; class: string }>) {
  if (!isToday) return <div class={className}>{children}</div>;
  return (
    <color-mode palette="blue" class={`surface-tinted ${className}`}>
      {children}
    </color-mode>
  );
}
