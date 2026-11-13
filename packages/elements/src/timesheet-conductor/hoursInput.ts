import { formatHours } from "../hours";

/** The input a cell's hours are typed into. */
export function hoursInputOf(cell: HTMLFormElement) {
  return cell.querySelector<HTMLInputElement>('input[name="hours"]');
}

/** Fires `input`, so listeners see the change as they would typed text. */
export function typeHours(input: HTMLInputElement, minutes: number) {
  input.value = formatHours(minutes);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
