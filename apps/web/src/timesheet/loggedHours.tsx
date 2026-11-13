import { formatHours, formatTotalHours } from "@tid/elements/hours";
import { Popover, ProgressBarSwatch } from "@tid/ui";
import { projectLabel, type Task } from "./loggableTasks";

type LoggedMinutes = { taskId: number; minutes: number };

/**
 * The month's hours against what the consultant should log, opening into the hours per project
 * in the order of the rows. A dot by each project marks it billable or not, in the colors the
 * consultant report uses for billable and non-billable hours.
 */
export function LoggedHours({
  rows,
  sumMinutes,
  expectedMinutes,
}: {
  rows: Task[];
  sumMinutes: (predicate: (entry: LoggedMinutes) => boolean) => number;
  expectedMinutes: number;
}) {
  const projects = Map.groupBy(rows, (task) => task.projectId);
  const loggedMinutes = sumMinutes(() => true);
  return (
    <div class="mx-auto w-max-3">
      <div class="stack-h flex-nowrap justify-between items-baseline gap-s fs-s t-tabular">
        <span class="ink-subtle">Logged hours</span>
        <span class="stack-h flex-nowrap items-baseline gap-xs">
          <Overtime loggedMinutes={loggedMinutes} expectedMinutes={expectedMinutes} />
          {/* A button, since only a button opens a popover without script. It reads as a link. */}
          <button type="button" class="v-link" popovertarget="logged-hours">
            <span data-logged-hours>{formatTotalHours(loggedMinutes)}</span> /{" "}
            {formatTotalHours(expectedMinutes)}
          </button>
        </span>
      </div>
      <Popover
        id="logged-hours"
        class="my-2xs w-full"
        data-type="tooltip"
        data-side="bottom"
        data-align="right"
        style="max-width: min(var(--width-3), 90svw);"
      >
        <div class="stack-v fs-s t-tabular surface-base br-m shadow-mid px-s py-xs">
          {[...projects].map(([projectId, tasks]) => {
            const taskIds = tasks.map((task) => task.id);
            const billable = tasks[0]?.billing !== "non_billable";
            return (
              <div class="stack-h flex-nowrap items-center gap-xs py-2xs b-b bc-subtle">
                <ProgressBarSwatch palette="blue" shade={billable ? "strong" : "soft"} />
                <a href={`/projects/${projectId}`} class="flex-1">
                  {tasks[0] && projectLabel(tasks[0])}
                </a>
                <span data-project-total={projectId}>
                  {formatHours(sumMinutes((entry) => taskIds.includes(entry.taskId)))}
                </span>
              </div>
            );
          })}
          <div class="stack-h justify-between gap-s py-2xs fw-medium">
            <span>Total</span>
            <span data-grand-total>{formatHours(loggedMinutes)}</span>
          </div>
          <div class="stack-h justify-between gap-s py-2xs ink-subtle">
            <span>Expected</span>
            <span>{formatHours(expectedMinutes)}</span>
          </div>
        </div>
      </Popover>
    </div>
  );
}

/** Always rendered, so the timesheet conductor can show it once typed hours pass what's expected. */
function Overtime({
  loggedMinutes,
  expectedMinutes,
}: {
  loggedMinutes: number;
  expectedMinutes: number;
}) {
  return (
    <span
      class="ink-subtle"
      data-overtime
      data-expected-minutes={expectedMinutes}
      hidden={loggedMinutes <= expectedMinutes}
    >
      +{formatTotalHours(Math.max(0, loggedMinutes - expectedMinutes))}
    </span>
  );
}
