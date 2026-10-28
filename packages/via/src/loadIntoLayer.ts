// Fetches a page for a layer and puts it where the load's outcome says: in the layer, in the next
// layer, in the layer below, or as the whole page.
import { attributes } from "./attributes";
import { type LoadedPage, showPageInLayer } from "./layerContent";
import { layerSelector, openerOf, openNextLayer } from "./layerStack";
import { outcomeOfLoad } from "./loadOutcome";

export async function loadIntoLayer(
  layer: HTMLElement,
  url: string,
  init: RequestInit,
  { leavesLayer = false } = {},
) {
  const page = await fetchPage(url, init).catch((error) => {
    // Loading a submission's URL afresh would drop it and what was typed, so the layer stays
    // for another try.
    if (init.method === "POST") throw error;
    location.assign(url);
  });
  if (!page) return;
  const isOpen = layer.matches(":popover-open");
  const shownUrl = layer.getAttribute(attributes.layerUrl);
  const below = layer.parentElement?.closest<HTMLElement>(layerSelector);
  const outcome = outcomeOfLoad({
    url: page.url,
    shownUrl: shownUrl ? new URL(shownUrl) : null,
    belowUrl: new URL(below?.getAttribute(attributes.layerUrl) ?? location.href),
    closed: !isOpen,
    leavesLayer,
  });
  if (outcome === "ignore") return;
  // A submission refused by something other than the app, like a proxy during a deploy. Loading
  // its URL would show an empty form, so the response is shown instead, as the browser would.
  if (!page.main && init.method === "POST") return replaceDocument(page.html);
  if (outcome === "reload" || !page.main) return location.assign(page.url);
  const loaded = { ...page, main: page.main };
  switch (outcome) {
    case "stay":
      return showPageInLayer(layer, loaded);
    case "openNext":
      return showPageInLayer(openNextLayer(layer), loaded);
    case "accept":
      // Hiding a layer hides any layer nested in it too, and each is removed once it has closed.
      // One accepted on its first page never opened, so there's nothing to hide.
      if (isOpen) layer.hidePopover();
      else layer.remove();
      if (below) return showPageInLayer(below, loaded);
      return replacePage(loaded, openerOf(layer));
  }
}

/**
 * Whatever the status, the HTML is shown: a failed submission comes back as its page, with errors.
 */
async function fetchPage(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const html = new DOMParser().parseFromString(await response.text(), "text/html");
  // After any redirect, so the page's own links resolve against where it really is.
  return { url: new URL(response.url), main: html.querySelector("main"), title: html.title, html };
}

function replaceDocument(html: Document) {
  document.documentElement.replaceWith(document.adoptNode(html.documentElement));
}

function replacePage(page: LoadedPage, opener: HTMLElement | undefined) {
  const { main } = page;
  document.title = page.title;
  document.querySelector("main")?.replaceWith(main);
  // The opener was replaced along with `main`, so focus goes back to its copy.
  const href = opener?.getAttribute("href");
  const openerCopy =
    href && main.querySelector<HTMLElement>(`a[${attributes.layer}][href="${CSS.escape(href)}"]`);
  main.tabIndex = -1;
  (openerCopy || main).focus();
}
