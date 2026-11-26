// via only swaps in a loaded page's `main`. Elements outside `main` that still need to change,
// like the toast saying what a submission did, are marked out-of-band and copied over here.
import { attributes } from "./attributes";

const outOfBandSelector = `[${attributes.outOfBand}][id]`;
const carriedKey = "via-out-of-band";

/** Each out-of-band element's HTML, by id. Plain strings, so it can go into session storage. */
type OutOfBand = Record<string, string>;

export function outOfBandOf(page: Document): OutOfBand {
  return Object.fromEntries(
    [...page.querySelectorAll(outOfBandSelector)].map((element) => [element.id, element.innerHTML]),
  );
}

/** Copies a loaded page's out-of-band content into the elements with the same id on this page. */
export function showOutOfBand(outOfBand: OutOfBand) {
  for (const element of document.querySelectorAll(outOfBandSelector)) {
    const content = outOfBand[element.id];
    // Replaces the content but keeps the element, so a screen reader notices a live region change.
    // Assigned even when unchanged, so the same message arriving again counts as new.
    if (content !== undefined) element.innerHTML = content;
  }
}

/**
 * Does a full page load of a page via has already fetched. The server rendered the out-of-band
 * content, like a toast, only for that fetch, so the reload would come back without it. It's kept
 * in session storage for the reloaded page to show. Not in history state: Chrome drops that when
 * loading another document.
 */
export function loadPageCarrying(url: URL, outOfBand: OutOfBand) {
  try {
    sessionStorage.setItem(carriedKey, JSON.stringify(outOfBand));
  } catch {
    // Without storage the page still loads, just without the toast.
  }
  location.assign(url);
}

/** Shows what `loadPageCarrying` kept, and removes it, so reloading the page won't show it again. */
export function showCarriedOutOfBand() {
  let carried: string | null = null;
  try {
    carried = sessionStorage.getItem(carriedKey);
    sessionStorage.removeItem(carriedKey);
  } catch {
    return;
  }
  if (carried) showOutOfBand(JSON.parse(carried));
}
