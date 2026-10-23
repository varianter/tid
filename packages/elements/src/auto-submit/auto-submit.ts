/**
 * Submits the form it wraps when one of that form's controls changes, so a
 * select or checkbox takes effect without pressing a button.
 */
class AutoSubmit extends HTMLElement {
  connectedCallback() {
    this.addEventListener("change", this.#onChange);
  }

  disconnectedCallback() {
    this.removeEventListener("change", this.#onChange);
  }

  #onChange = (event: Event) => {
    const control = event.target;
    if (
      !(control instanceof HTMLInputElement) &&
      !(control instanceof HTMLSelectElement) &&
      !(control instanceof HTMLTextAreaElement)
    )
      return;
    control.form?.requestSubmit();
  };
}

customElements.define("auto-submit", AutoSubmit);
