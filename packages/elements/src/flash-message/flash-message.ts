/**
 * The toast that says what the last form submission did. It's a manual popover, so it shows above
 * any open layer and stays until dismissed or until a page without a message arrives.
 *
 * The server renders the message inside it. When via loads a page without a full reload, via swaps
 * in that page's message (see via's `outOfBand`), and this element shows it.
 */
class FlashMessage extends HTMLElement {
  #messageChanged = new MutationObserver(() => this.#announce());
  /** Counts messages, so a message waiting to be put back can tell a newer one has arrived. */
  #arrivals = 0;
  /** Where focus was before it moved into the toast, to go back to once it's dismissed. */
  #focusBefore: Element | null = null;

  get #liveRegion() {
    return this.querySelector('[role="status"]');
  }

  connectedCallback() {
    this.addEventListener("focusin", this.#rememberFocus);
    this.addEventListener("beforetoggle", this.#returnFocus);
    const liveRegion = this.#liveRegion;
    if (liveRegion) this.#messageChanged.observe(liveRegion, { childList: true });
    window.addEventListener("pageshow", this.#hideOnReturn);
    this.#announce();
  }

  disconnectedCallback() {
    this.removeEventListener("focusin", this.#rememberFocus);
    this.removeEventListener("beforetoggle", this.#returnFocus);
    window.removeEventListener("pageshow", this.#hideOnReturn);
    this.#messageChanged.disconnect();
  }

  /** Going back to a page restored from the back/forward cache shouldn't show its message again. */
  #hideOnReturn = (event: PageTransitionEvent) => {
    if (event.persisted && this.matches(":popover-open")) this.hidePopover();
  };

  #announce() {
    const liveRegion = this.#liveRegion;
    if (!liveRegion) return;
    const arrival = ++this.#arrivals;
    // The new page has no message, so the old one no longer applies. Without this the toast
    // would stay open with nothing in it.
    if (!liveRegion.hasChildNodes()) {
      if (this.matches(":popover-open")) this.hidePopover();
      return;
    }
    // Screen readers only announce a change to a live region that's already showing. So the
    // message is taken out, the toast is shown, and the message is put back a moment later.
    const message = [...liveRegion.childNodes];
    this.#changeQuietly(() => liveRegion.replaceChildren());
    if (!this.matches(":popover-open")) this.showPopover();
    setTimeout(() => {
      if (arrival !== this.#arrivals) return;
      this.#changeQuietly(() => liveRegion.replaceChildren(...message));
    }, 100);
  }

  #rememberFocus = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node && this.contains(event.relatedTarget))) {
      this.#focusBefore = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    }
  };

  /** Without this, dismissing the toast with focus inside it would leave focus on the page's body. */
  #returnFocus = (event: Event) => {
    if ((event as ToggleEvent).newState !== "closed") return;
    if (!this.contains(document.activeElement)) return;
    const focusBefore = this.#focusBefore;
    if (focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus();
  };

  /** Changes the message without the observer treating it as a new message. */
  #changeQuietly(change: () => void) {
    change();
    this.#messageChanged.takeRecords();
  }
}

customElements.define("flash-message", FlashMessage);
