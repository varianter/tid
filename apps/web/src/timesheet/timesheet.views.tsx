import { Button, Input, Label, Page, PeriodNavigation, Popover } from "@tid/ui";
import type { PropsWithChildren } from "hono/jsx";
import {
  formatDateRange,
  formatDayMonth,
  formatHours,
  formatMonth,
  formatWeekday,
  mondayOf,
  todayInOslo,
} from "../dates/dates";

type Task = { id: number; name: string; projectName: string };
type TimeEntry = { taskId: number; spentOn: string; minutes: number };

type TimesheetGridProps = {
  days: string[];
  tasks: Task[];
  entries: TimeEntry[];
  cellsAction: string;
  addedTaskIds: number[];
  /** The current query string, kept when adding a row. */
  search: string;
};

type PeriodLinks = { previousHref: string; nextHref: string };

export function WeekPage({
  monday,
  sunday,
  previousHref,
  nextHref,
  ...grid
}: { monday: string; sunday: string } & PeriodLinks & TimesheetGridProps) {
  return (
    <Page
      title="Timesheet"
      actions={
        <PeriodNavigation
          previousHref={previousHref}
          nextHref={nextHref}
          previousLabel="Previous week"
          nextLabel="Next week"
        >
          {formatDateRange(monday, sunday)}
        </PeriodNavigation>
      }
    >
      <TimesheetGrid {...grid} inputWidth="9ch" />
    </Page>
  );
}

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
      <TimesheetGrid {...grid} inputWidth="8ch" />
    </Page>
  );
}

function TimesheetGrid({
  days,
  tasks,
  entries,
  inputWidth,
  cellsAction,
  addedTaskIds,
  search,
}: TimesheetGridProps & {
  /** Caps the inputs, which in turn size the day columns. */
  inputWidth: string;
}) {
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
  const addRowHref = (taskId: number) => {
    const params = new URLSearchParams(search);
    params.append("add", String(taskId));
    return `?${params}`;
  };

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
              {/* ponytail: nothing handles this POST yet; saving comes with the database. */}
              <form method="post" action={cellsAction} class="d-block">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="date" value={day} />
                <Input
                  name="value"
                  type="text"
                  value={formatHours(minutesOn(task.id, day))}
                  class="ta-right w-min-0 w-full"
                  data-size="small"
                  style={`max-width: ${inputWidth}`}
                  inputmode="decimal"
                  aria-label={`${task.projectName}, ${task.name}, ${formatWeekday(day)} ${day}`}
                />
              </form>
            </TodayTint>
          ))}
          <div class={`ta-right fw-medium self-stretch stack-v justify-center ${stickyEnd} fs-s`}>
            {formatHours(sumMinutes((entry) => entry.taskId === task.id))}
          </div>
        </div>
      ))}

      <div class="grid-subgrid grid-all-columns fw-medium ta-right py-s fs-s">
        <div class={`ta-left ${stickyStart}`}>Total</div>
        {days.map((day, index) => (
          <div class={`px-xs${weekGap(index)}`}>
            {formatHours(sumMinutes((entry) => entry.spentOn === day))}
          </div>
        ))}
        <div class={stickyEnd}>{formatHours(sumMinutes(() => true))}</div>
      </div>

      <div class="grid-all-columns py-xs">
        <Button type="button" data-variant="filled" popovertarget="add-row">
          Add row
        </Button>
        <Popover id="add-row" data-type="dialog" style="max-width: 500px;" class="w-full">
          <div class="w-full surface-base shadow-high p-m stack-v gap-s">
            <div class="stack-h justify-between items-center">
              <h2>Add row</h2>
              <Button
                type="button"
                data-variant="plain"
                popovertarget="add-row"
                popovertargetaction="hide"
              >
                Close
              </Button>
            </div>
            {addableByProject.map(([projectName, projectTasks]) => (
              <section class=" gap-3xs">
                <h3 class="fs-xs ink-subtle">{projectName}</h3>
                <ul class="stack-v py-3xs">
                  {projectTasks?.map((task) => (
                    <li>
                      <a
                        class="py-3xs px-xs bg-wash:hover w-full d-block"
                        href={addRowHref(task.id)}
                      >
                        {task.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Popover>
      </div>
    </div>
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
