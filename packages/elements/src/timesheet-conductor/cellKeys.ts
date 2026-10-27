import { formatHours, parseHours } from "../hours";

const halfHour = 30;
const wholeDay = 24 * 60;

/** Steps to the next half hour up or down, so an odd value lands back on the half-hour grid. */
export function stepHalfHour(minutes: number, direction: 1 | -1) {
  const stepped =
    direction === 1
      ? Math.floor(minutes / halfHour) * halfHour + halfHour
      : Math.ceil(minutes / halfHour) * halfHour - halfHour;
  return Math.min(Math.max(stepped, 0), wholeDay);
}

/** What's left of the day after the other cells, never below zero. */
export function remainingMinutes(fullDay: number, others: number[]) {
  return Math.max(fullDay - others.reduce((total, minutes) => total + minutes, 0), 0);
}

/**
 * Spreadsheet keys for the timesheet's cells: arrows move between cells, T jumps to today,
 * shift+↑/↓ steps half an hour, F fills in what's left of the day, and A opens the task picker. Values only change in the input;
 * leaving the cell saves.
 */
export class CellKeys {
  #grid: HTMLElement;

  /** The grid holds the cells and the `full-day-minutes` and `today` attributes. */
  constructor(grid: HTMLElement) {
    this.#grid = grid;
  }

  connect() {
    this.#grid.addEventListener("keydown", this.#onKeyDown);
  }

  disconnect() {
    this.#grid.removeEventListener("keydown", this.#onKeyDown);
  }

  #onKeyDown = (event: KeyboardEvent) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "hours") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const form = input.form;
    if (!form?.dataset.cell) return;

    const handled = (() => {
      switch (event.key) {
        case "ArrowUp":
        case "ArrowDown": {
          const up = event.key === "ArrowUp";
          return event.shiftKey
            ? stepHours(input, up ? 1 : -1)
            : this.#moveToward(form, up ? "up" : "down");
        }
        case "ArrowLeft":
          return !event.shiftKey && caretAtStart(input) && this.#moveToward(form, "left");
        case "ArrowRight":
          return !event.shiftKey && caretAtEnd(input) && this.#moveToward(form, "right");
        case "f":
        case "F": {
          const fullDay = Number(this.#grid.getAttribute("full-day-minutes"));
          if (!fullDay) return false;
          const remaining = remainingMinutes(fullDay, this.#otherMinutesOnDay(form));
          // A full day is left alone rather than wiped. Still handled, so no "f" gets typed.
          if (remaining > 0) input.value = formatHours(remaining);
          return true;
        }
        case "t":
        case "T":
          // Handled even when today isn't on the sheet, so no "t" gets typed.
          this.#moveToToday(form);
          return true;
        case "a":
        case "A":
          // Handled even when there are no tasks to add, so no "a" gets typed.
          this.#grid.querySelector<HTMLSelectElement>('select[name="add"]')?.showPicker();
          return true;
        default:
          return false;
      }
    })();
    if (handled) event.preventDefault();
  };

  /**
   * Focuses the neighbouring cell that's on screen in that direction. Narrow screens turn the
   * grid so days run down, so which neighbour is "below" depends on the layout, not the markup.
   */
  #moveToward(form: HTMLFormElement, direction: Direction) {
    const taskId = form.dataset.cell?.split(":")[0];
    const neighbours = [
      ...this.#neighboursOf(form, `form[data-cell^="${taskId}:"]`),
      ...this.#neighboursOf(form, `form[data-day="${form.dataset.day}"]`),
    ];
    const from = centreOf(form);
    return focusCell(neighbours.find((neighbour) => lies(direction, from, centreOf(neighbour))));
  }

  /** Stays on the same task, so the jump keeps your place. Days outside the sheet don't move. */
  #moveToToday(form: HTMLFormElement) {
    const taskId = form.dataset.cell?.split(":")[0];
    const today = this.#grid.getAttribute("today");
    return focusCell(
      this.#grid.querySelector<HTMLFormElement>(`form[data-cell="${taskId}:${today}"]`),
    );
  }

  /**
   * Read from the inputs rather than `data-minutes`, since a cell you just left may still be saving.
   * Text that isn't hours counts as nothing.
   */
  #otherMinutesOnDay(form: HTMLFormElement) {
    return [...this.#grid.querySelectorAll<HTMLFormElement>(`form[data-day="${form.dataset.day}"]`)]
      .filter((cell) => cell !== form)
      .map(
        (cell) =>
          parseHours(cell.querySelector<HTMLInputElement>('input[name="hours"]')?.value ?? "") ?? 0,
      );
  }

  /** The cells before and after this one among those matching. */
  #neighboursOf(form: HTMLFormElement, selector: string) {
    const cells = [...this.#grid.querySelectorAll<HTMLFormElement>(selector)];
    const index = cells.indexOf(form);
    return [cells[index - 1], cells[index + 1]].filter((cell) => cell !== undefined);
  }
}

/** Selects the cell's text, so typing replaces it. */
function focusCell(form: HTMLFormElement | null | undefined) {
  const input = form?.querySelector<HTMLInputElement>('input[name="hours"]');
  if (!input) return false;
  input.focus();
  input.select();
  return true;
}

type Direction = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };

function centreOf(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Whether `to` is mostly in that direction from `from`. */
function lies(direction: Direction, from: Point, to: Point) {
  const across = to.x - from.x;
  const down = to.y - from.y;
  switch (direction) {
    case "up":
      return -down > Math.abs(across);
    case "down":
      return down > Math.abs(across);
    case "left":
      return -across > Math.abs(down);
    case "right":
      return across > Math.abs(down);
  }
}

/** Leaves text that isn't hours alone, so the key does nothing rather than wiping it. */
function stepHours(input: HTMLInputElement, direction: 1 | -1) {
  const minutes = parseHours(input.value);
  if (minutes === undefined) return false;
  input.value = formatHours(stepHalfHour(minutes, direction));
  return true;
}

// A cell's whole text selected counts as being at either edge, so arrows keep moving after landing.
const wholeTextSelected = (input: HTMLInputElement) =>
  input.selectionStart === 0 && input.selectionEnd === input.value.length;

const caretAtStart = (input: HTMLInputElement) =>
  wholeTextSelected(input) || (input.selectionStart === 0 && input.selectionEnd === 0);

const caretAtEnd = (input: HTMLInputElement) =>
  wholeTextSelected(input) || input.selectionStart === input.value.length;
