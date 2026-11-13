import { fillDay } from "./dayFill";
import { hoursInputOf } from "./hoursInput";

/** Answers each cell's `[data-fill-day]` button by filling in what's left of the cell's day. */
export class FillDayButtons {
  #grid: HTMLElement;

  constructor(grid: HTMLElement) {
    this.#grid = grid;
  }

  connect() {
    this.#grid.addEventListener("pointerdown", this.#onPointerDown);
    this.#grid.addEventListener("click", this.#onClick);
  }

  disconnect() {
    this.#grid.removeEventListener("pointerdown", this.#onPointerDown);
    this.#grid.removeEventListener("click", this.#onClick);
  }

  /** Keeps focus, and so the on-screen keyboard and the button, on the cell while it's pressed. */
  #onPointerDown = (event: PointerEvent) => {
    if (fillDayButtonOf(event.target)) event.preventDefault();
  };

  #onClick = (event: MouseEvent) => {
    const cell = fillDayButtonOf(event.target)?.form;
    const input = cell && hoursInputOf(cell);
    if (!input) return;
    fillDay(this.#grid, input);
    input.focus();
  };
}

function fillDayButtonOf(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLButtonElement>("button[data-fill-day]")
    : null;
}
