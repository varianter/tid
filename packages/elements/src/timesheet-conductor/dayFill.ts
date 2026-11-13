import { parseHours } from "../hours";
import { hoursInputOf, typeHours } from "./hoursInput";

/** What's left of the day after the other cells, never below zero. */
export function remainingMinutes(fullDay: number, others: number[]) {
  return Math.max(fullDay - others.reduce((total, minutes) => total + minutes, 0), 0);
}

/**
 * Types what's left of the cell's day into it. A full day is left alone rather than wiped.
 * The grid holds the cells and the `full-day-minutes` attribute.
 */
export function fillDay(grid: HTMLElement, input: HTMLInputElement) {
  const fullDay = Number(grid.getAttribute("full-day-minutes"));
  if (!input.form || !fullDay) return;
  const remaining = remainingMinutes(fullDay, otherMinutesOnDay(grid, input.form));
  if (remaining > 0) typeHours(input, remaining);
}

/**
 * Read from the inputs rather than `data-minutes`, since a cell you just left may still be saving.
 * Text that isn't hours counts as nothing.
 */
function otherMinutesOnDay(grid: HTMLElement, cell: HTMLFormElement) {
  return [...grid.querySelectorAll<HTMLFormElement>(`form[data-day="${cell.dataset.day}"]`)]
    .filter((other) => other !== cell)
    .map((other) => parseHours(hoursInputOf(other)?.value ?? "") ?? 0);
}
