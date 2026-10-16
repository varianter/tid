import { formatDate } from "@tid/calendar/dateDisplay";
import { isIsoDate } from "@tid/calendar/isoDate";
import { formatHours } from "@tid/elements/hours";
import { ColorMode, Input, Popover } from "@tid/ui";
import { z } from "zod";
import type { Task } from "./loggableTasks";

export const cellFields = z.object({
  taskId: z.coerce.number().int().positive(),
  date: z.string().refine(isIsoDate),
});

export const hoursHint = "Enter hours, like 7,5";

/** Hours as typed, in half hours up to a day, as minutes. Blank or zero clears the cell. */
export const cellHours = z
  .string()
  .trim()
  .regex(/^(\d+([.,]\d+)?)?$/, hoursHint)
  .transform((text) => Number(text.replace(",", ".")))
  .refine((hours) => hours <= 24, "At most 24 hours")
  .refine((hours) => Number.isInteger(hours * 2), "Use half hours, like 1,5")
  .transform((hours) => hours * 60);

/** A save that failed, shown on its cell with what the user typed. */
export type CellError = { typed: string; message: string };

// Caps the inputs, which in turn size the day columns.
export const inputWidth = "8ch";

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
  locked = false,
}: {
  task: Task;
  day: string;
  minutes: number;
  action: string;
  error?: CellError;
  locked?: boolean;
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
      aria-label={`${task.projectName}, ${task.name}, ${formatDate(day)}`}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? errorId : undefined}
      pattern="[0-9]+([.,:][0-9]+)?"
      disabled={locked}
    />
  );
  return (
    <form
      method="post"
      action={action}
      class="d-block"
      data-cell={`${task.id}:${day}`}
      data-project={task.projectId}
      data-day={day}
      data-minutes={minutes}
    >
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="date" value={day} />
      {error ? (
        <ColorMode palette="coral" class="pos-relative stack-h nowrap items-center gap-3xs">
          {input}
          <button
            type="button"
            popovertarget={errorId}
            aria-label="Show error"
            class="m-2xs pos-absolute"
          >
            <ErrorIcon />
          </button>
          <Popover id={errorId} data-type="tooltip" class="px-2xs py-2xs">
            <div class="b-all bc-subtle px-xs py-2xs surface-base br-m shadow-mid fs-s">
              {error.message}
            </div>
          </Popover>
        </ColorMode>
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
