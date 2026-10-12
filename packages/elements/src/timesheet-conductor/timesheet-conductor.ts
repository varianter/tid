// Same rule as the server's formatHours, so a total reads the same before and after a reload.
const hoursFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });
const formatHours = (minutes: number) => (minutes === 0 ? "" : hoursFormat.format(minutes / 60));

/**
 * Saves timesheet cells as you leave them, without reloading the page.
 * Each cell is a form the server renders; this posts it and swaps in the form it gets back.
 */
class TimesheetConductor extends HTMLElement {
  /** The save in flight per cell, so a newer value never lands before an older one. */
  #saves = new Map<string, Promise<void>>();
  /** The value each cell last sent, so blur and Enter on the same value save once. */
  #sent = new Map<string, string>();

  connectedCallback() {
    // `change` fires when a text input loses focus with a new value, and on Enter.
    this.addEventListener("change", this.#onChange);
    this.addEventListener("submit", this.#onSubmit);
  }

  disconnectedCallback() {
    this.removeEventListener("change", this.#onChange);
    this.removeEventListener("submit", this.#onSubmit);
  }

  #onChange = (event: Event) => {
    const form = cellOf(event.target);
    if (form) this.#queueSave(form);
  };

  #onSubmit = (event: SubmitEvent) => {
    const form = cellOf(event.target);
    if (!form) return;
    event.preventDefault();
    this.#queueSave(form);
  };

  #queueSave(form: HTMLFormElement) {
    const key = keyOf(form);
    const previous = this.#saves.get(key) ?? Promise.resolve();
    const save = previous.then(() => this.#save(key));
    this.#saves.set(key, save);
    // Drops the entry once it's the last save, so the map doesn't grow with every edit.
    save.finally(() => this.#saves.get(key) === save && this.#saves.delete(key));
  }

  async #save(key: string) {
    // Looked up now rather than when queued, since an earlier save may have swapped the form.
    const form = this.querySelector<HTMLFormElement>(`form[data-cell="${key}"]`);
    const input = form && hoursInputOf(form);
    if (!form || !input) return;
    const value = input.value;
    if (this.#sent.get(key) === value) return;
    this.#sent.set(key, value);

    const fresh = await postCell(form);
    if (!fresh) {
      // Lets the next change try again, and keeps what the user typed.
      this.#sent.delete(key);
      input.setAttribute("aria-invalid", "true");
      input.title = "Not saved. Check your connection and try again.";
      return;
    }
    this.#sent.set(key, hoursInputOf(fresh)?.value ?? value);
    form.dataset.minutes = fresh.dataset.minutes;
    // Typing since the save went out wins; the next change saves it.
    if (input.value === value) {
      const hadFocus = form.contains(document.activeElement);
      form.replaceWith(fresh);
      if (hadFocus) hoursInputOf(fresh)?.focus();
    }
    this.#updateTotals(form.dataset.task ?? "", form.dataset.day ?? "");
  }

  #updateTotals(task: string, day: string) {
    const minutesIn = (selector: string) =>
      [...this.querySelectorAll<HTMLFormElement>(selector)].reduce(
        (total, form) => total + Number(form.dataset.minutes),
        0,
      );
    const show = (selector: string, minutes: number) => {
      const total = this.querySelector(selector);
      if (total) total.textContent = formatHours(minutes);
    };
    show(`[data-task-total="${task}"]`, minutesIn(`form[data-task="${task}"]`));
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

/** The cell the server sends back, saved or with an error, or nothing if the save failed. */
async function postCell(form: HTMLFormElement) {
  try {
    const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
    // 422 is a cell with an error to show; anything else but 200 has no cell in it.
    if (response.status !== 200 && response.status !== 422) return null;
    const template = document.createElement("template");
    template.innerHTML = await response.text();
    const fresh = template.content.firstElementChild;
    return fresh instanceof HTMLFormElement && keyOf(fresh) === keyOf(form) ? fresh : null;
  } catch {
    return null;
  }
}

customElements.define("timesheet-conductor", TimesheetConductor);
