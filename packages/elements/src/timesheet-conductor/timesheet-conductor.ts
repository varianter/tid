// The server renders hours with the same function, so a total reads the same before and after a reload.
import { formatHours, parseHours } from "../hours";
import { CellKeys } from "./cellKeys";

/**
 * Saves timesheet cells as you leave them or the page, without reloading it, and keeps the totals
 * in step with what's typed.
 * Each cell is a form the server renders; this posts it to `cell-action` instead of the form's
 * own action, which answers with the whole month, and swaps in the form it gets back.
 * An input's default value is what the server last rendered, so an unchanged cell isn't posted.
 */
class TimesheetConductor extends HTMLElement {
  /** The latest save per cell, so a newer value never lands before an older one. */
  #saves = new Map<string, Promise<void>>();
  #keys = new CellKeys(this);

  connectedCallback() {
    // `focusout` rather than `change`, so leaving a cell retries a save that failed.
    this.addEventListener("focusout", this.#onFocusOut);
    this.addEventListener("submit", this.#onSubmit);
    this.addEventListener("input", this.#onInput);
    // `focusout` isn't sure to fire as the page goes away.
    window.addEventListener("pagehide", this.#onPageHide);
    window.addEventListener("beforeunload", this.#onBeforeUnload);
    this.#keys.connect();
  }

  disconnectedCallback() {
    this.removeEventListener("focusout", this.#onFocusOut);
    this.removeEventListener("submit", this.#onSubmit);
    this.removeEventListener("input", this.#onInput);
    window.removeEventListener("pagehide", this.#onPageHide);
    window.removeEventListener("beforeunload", this.#onBeforeUnload);
    this.#keys.disconnect();
  }

  #onFocusOut = (event: FocusEvent) => {
    const form = cellOf(event.target);
    if (form) this.#queueSave(form);
  };

  #onSubmit = (event: SubmitEvent) => {
    const form = cellOf(event.target);
    if (!form) return;
    event.preventDefault();
    this.#queueSave(form);
  };

  #onInput = (event: Event) => {
    const form = cellOf(event.target);
    if (form) this.#updateTotals(form.dataset.project ?? "", form.dataset.day ?? "");
  };

  /**
   * Sends every changed cell, unanswered: the page is gone before a reply could be swapped in.
   * A cell still saving is sent again, which stores the same hours.
   */
  #onPageHide = () => {
    const cellAction = this.getAttribute("cell-action") ?? "";
    for (const form of this.querySelectorAll<HTMLFormElement>("form[data-cell]")) {
      const input = hoursInputOf(form);
      if (!input || input.value === input.defaultValue) continue;
      fetch(cellAction, { method: "POST", body: new FormData(form), keepalive: true }).catch(
        reportError,
      );
    }
  };

  /**
   * A cell that failed to save offline is likely to fail again as the page closes. One typed back
   * to what's stored has nothing left to lose.
   */
  #onBeforeUnload = (event: BeforeUnloadEvent) => {
    const unsaved = this.querySelectorAll<HTMLInputElement>("input[data-unsaved]");
    if ([...unsaved].some((input) => input.value !== input.defaultValue)) event.preventDefault();
  };

  #queueSave(form: HTMLFormElement) {
    const key = keyOf(form);
    const previous = this.#saves.get(key) ?? Promise.resolve();
    // Caught, so one failed save doesn't skip the ones queued after it.
    this.#saves.set(key, previous.then(() => this.#save(key)).catch(reportError));
  }

  async #save(key: string) {
    // Looked up now rather than when queued, since an earlier save may have swapped the form.
    const form = this.querySelector<HTMLFormElement>(`form[data-cell="${key}"]`);
    const input = form && hoursInputOf(form);
    if (!form || !input || input.value === input.defaultValue) return;

    const sent = input.value;
    const result = await postCell(form, this.getAttribute("cell-action") ?? "");
    if (result === "offline") return markUnsaved(input);
    // The server answered with something other than a cell, such as a login redirect or an
    // error page. Submitting the form for real shows it.
    if (result === "rejected") return form.submit();
    this.#swapCell(form, input, sent, result);
  }

  #swapCell(form: HTMLFormElement, input: HTMLInputElement, sent: string, fresh: HTMLFormElement) {
    const freshInput = hoursInputOf(fresh);
    if (!freshInput) return;
    // Keeps what was typed while the save was out; the next save sends it.
    if (input.value !== sent) freshInput.value = input.value;
    const hadFocus = input === document.activeElement;
    form.replaceWith(fresh);
    if (hadFocus) {
      freshInput.focus();
      freshInput.setSelectionRange(input.selectionStart, input.selectionEnd);
    }
    this.#updateTotals(fresh.dataset.project ?? "", fresh.dataset.day ?? "");
  }

  #updateTotals(project: string, day: string) {
    const minutesIn = (selector: string) =>
      [...this.querySelectorAll<HTMLFormElement>(selector)].reduce(
        (total, form) => total + shownMinutesOf(form),
        0,
      );
    const show = (selector: string, minutes: number) => {
      const total = this.querySelector(selector);
      if (total) total.textContent = formatHours(minutes);
    };
    show(`[data-project-total="${project}"]`, minutesIn(`form[data-project="${project}"]`));
    show(`[data-day-total="${day}"]`, minutesIn(`form[data-day="${day}"]`));
    show("[data-grand-total]", minutesIn("form[data-minutes]"));
  }
}

function cellOf(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLFormElement>("form[data-cell]") : null;
}

const keyOf = (form: HTMLFormElement) => form.dataset.cell ?? "";

const hoursInputOf = (form: HTMLFormElement) =>
  form.querySelector<HTMLInputElement>('input[name="hours"]');

/**
 * What a cell adds to the totals: the hours typed, or what's stored while they aren't hours yet.
 * A cell the server sent back with an error shows what was typed, which isn't stored.
 */
function shownMinutesOf(form: HTMLFormElement) {
  const stored = Number(form.dataset.minutes);
  const input = hoursInputOf(form);
  if (!input || input.value === input.defaultValue) return stored;
  return parseHours(input.value) ?? stored;
}

/** Keeps what the user typed, marked, so leaving the cell again retries it. */
function markUnsaved(input: HTMLInputElement) {
  input.setAttribute("aria-invalid", "true");
  // Apart from `aria-invalid`, which a cell the server rejected has too.
  input.dataset.unsaved = "";
  input.title = "Not saved. Check your connection and try again.";
}

/**
 * The cell the server sends back, saved or with an error. "offline" when the request never got
 * an answer, and "rejected" when the answer isn't a cell.
 */
async function postCell(
  form: HTMLFormElement,
  cellAction: string,
): Promise<HTMLFormElement | "offline" | "rejected"> {
  let response: Response;
  let html: string;
  try {
    // Manual, so a login redirect to another origin is a response here rather than a CORS error.
    response = await fetch(cellAction, {
      method: "POST",
      body: new FormData(form),
      redirect: "manual",
    });
    html = await response.text();
  } catch {
    return "offline";
  }
  // 422 is a cell with an error to show; anything else but 200 has no cell in it.
  if (response.status !== 200 && response.status !== 422) return "rejected";
  const template = document.createElement("template");
  template.innerHTML = html;
  const fresh = template.content.firstElementChild;
  return fresh instanceof HTMLFormElement && keyOf(fresh) === keyOf(form) ? fresh : "rejected";
}

customElements.define("timesheet-conductor", TimesheetConductor);
