import { formatHours } from "@tid/elements/hours";
import { Section } from "@tid/ui";
import type { Task } from "./loggableTasks";

type LoggedMinutes = { taskId: number; minutes: number };

/** The month's hours per project, against what the consultant should log. */
export function ProjectTotals({
  rows,
  sumMinutes,
  expectedMinutes,
}: {
  rows: Task[];
  sumMinutes: (predicate: (entry: LoggedMinutes) => boolean) => number;
  expectedMinutes: number;
}) {
  const projects = Map.groupBy(rows, (task) => task.projectId);
  return (
    <Section title="Project totals" class="w-max-5">
      <div class="stack-v fs-s t-tabular">
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
        <div class="stack-h justify-between gap-s py-2xs ink-subtle">
          <span>Expected</span>
          <span>{formatHours(expectedMinutes)}</span>
        </div>
      </div>
    </Section>
  );
}
