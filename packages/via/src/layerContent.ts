import { attributes } from "./attributes";
import { openerOf } from "./layerStack";

export type LoadedPage = { url: URL; main: HTMLElement; title: string };

/** Shows a loaded page in a layer, opening it next to its link if it isn't open yet. */
export function showPageInLayer(layer: HTMLElement, page: LoadedPage) {
  const opener = openerOf(layer);
  layer.setAttribute(attributes.layerUrl, page.url.href);
  layer.setAttribute("aria-label", page.title);
  // The page says how it's shown, so one step of a form can be a tooltip and the next a drawer.
  // Its box moves in whole, bringing the page's width and padding with it.
  const box = page.main.querySelector(`:scope > [${attributes.layerType}]`);
  layer.setAttribute("data-type", box?.getAttribute(attributes.layerType) ?? "dialog");
  placeLayer(layer, opener);
  resolveUrls(page.main, page.url);
  // Only the content is replaced, so nested layers stay. `main` itself never moves in, so the
  // document keeps a single `main`.
  layer
    .querySelector(`[${attributes.layerContent}]`)
    ?.replaceChildren(...(box ? [box] : page.main.childNodes));
  if (!layer.matches(":popover-open")) layer.showPopover({ source: opener });
  // A submission that failed lands on its first invalid field rather than the top of the form.
  const invalid = layer.querySelector<HTMLElement>('[aria-invalid="true"]');
  (invalid ?? layer.querySelector<HTMLElement>("[autofocus]") ?? layer).focus();
}

/**
 * A tooltip sits where its link's `via-layer-side` and `via-layer-align` say, since only the
 * link's page knows where the link is. Varde reads the same attributes as the edge a drawer
 * slides in from, so other types drop them and a drawer keeps to the right.
 */
function placeLayer(layer: HTMLElement, opener: HTMLElement | undefined) {
  const tooltipOpener = layer.getAttribute("data-type") === "tooltip" ? opener : undefined;
  const placements = [
    ["data-side", attributes.layerSide],
    ["data-align", attributes.layerAlign],
  ] as const;
  for (const [placement, attribute] of placements) {
    const value = tooltipOpener?.getAttribute(attribute);
    if (value) layer.setAttribute(placement, value);
    else layer.removeAttribute(placement);
  }
}

/**
 * The layer's content came from another URL, so its relative links and form actions would
 * otherwise resolve against the page's. A form without an action posts to its own page.
 */
function resolveUrls(main: HTMLElement, url: URL) {
  for (const form of main.querySelectorAll("form:not([action]), form[action='']")) {
    form.setAttribute("action", url.href);
  }
  const urlAttributes = [
    ["[href]", "href"],
    ["form[action]", "action"],
    ["[formaction]", "formaction"],
  ] as const;
  for (const [selector, attribute] of urlAttributes) {
    for (const element of main.querySelectorAll(selector)) {
      element.setAttribute(attribute, new URL(element.getAttribute(attribute) ?? "", url).href);
    }
  }
}
