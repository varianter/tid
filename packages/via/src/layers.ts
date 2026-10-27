// Opens `a[via-layer]` links in a popover layer, and keeps every link and form inside a layer
// there until it's accepted or dismissed. The URL never changes.
//
// A page provides `template#via-layer`: a popover with a `[via-layer-content]` element that
// receives each loaded page's `main`. A link may set `via-layer-side` and `via-layer-align` to
// place a tooltip next to it. A loaded `main` may set `via-layer-type` to a Varde popover type.
import { isAccepted } from "./acceptance";

// A layer is a clone of the page's `template#via-layer`. Nested layers sit inside their parent,
// so the native popover stack keeps the parent open and closes them along with it.
const layerSelector = "[via-layer-url]";
// The link a layer was opened from, which a tooltip is placed next to.
const openers = new WeakMap<HTMLElement, HTMLElement>();

// A click or submit navigates within the same task, so the source is forgotten after it and
// can't be mistaken for the source of a later navigation.
let lastSource: Element | null = null;
const rememberSource = (source: EventTarget | null) => {
  lastSource = source instanceof Element ? source : null;
  setTimeout(() => (lastSource = null));
};
document.addEventListener("click", (event) => rememberSource(event.target), { capture: true });
document.addEventListener("submit", (event) => rememberSource(event.submitter ?? event.target), {
  capture: true,
});

navigation.addEventListener("navigate", (event) => {
  // ponytail: lastSource stands in for sourceElement until every browser we support has it.
  const source = event.sourceElement ?? lastSource;
  if (!source || !event.cancelable || !event.canIntercept) return;
  if (event.navigationType !== "push" && event.navigationType !== "replace") return;
  if (event.hashChange || event.downloadRequest !== null || opensElsewhere(source)) return;

  const opener = source.closest<HTMLAnchorElement>("a[via-layer]");
  const layer = opener ? openLayer(opener) : source.closest<HTMLElement>(layerSelector);
  if (!layer) return;
  event.preventDefault();
  const init = event.formData ? { method: "POST", body: event.formData } : {};
  void load(layer, event.destination.url, init);
});

/** `target="_top"` and the like are how a link or form leaves its layer. */
function opensElsewhere(source: Element) {
  const target =
    source instanceof HTMLButtonElement || source instanceof HTMLInputElement
      ? source.formTarget || source.form?.target
      : source instanceof HTMLFormElement
        ? source.target
        : source.closest("a")?.target;
  return Boolean(target) && target !== "_self";
}

function openLayer(opener: HTMLAnchorElement) {
  const template = document.querySelector<HTMLTemplateElement>("template#via-layer");
  const layer = template?.content.firstElementChild?.cloneNode(true);
  if (!(layer instanceof HTMLElement)) throw new Error("The page has no template#via-layer");
  openers.set(layer, opener);
  // ponytail: a click outside closes the layer and loses what was typed in it. A <dialog> with
  // closedby="closerequest" keeps it, once layers can be dialogs.
  layer.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState === "closed") layer.remove();
  });
  (opener.closest(layerSelector) ?? document.body).append(layer);
  return layer;
}

async function load(layer: HTMLElement, url: string, init: RequestInit) {
  let response: Response;
  let page: Document;
  try {
    response = await fetch(url, init);
    page = new DOMParser().parseFromString(await response.text(), "text/html");
  } catch (error) {
    // Loading a submission's URL afresh would drop it and what was typed, so the layer stays
    // for another try.
    if (init.method === "POST") throw error;
    location.assign(url);
    return;
  }
  const arrivedAt = new URL(response.url);
  const main = page.querySelector("main");
  if (!main) {
    location.assign(arrivedAt);
    return;
  }
  const below = layer.parentElement?.closest<HTMLElement>(layerSelector);
  const belowUrl = new URL(below?.getAttribute("via-layer-url") ?? location.href);
  if (!isAccepted(arrivedAt, belowUrl)) {
    show(layer, main, arrivedAt, page.title);
    return;
  }
  // Removing a layer also closes it, and any layer nested in it.
  layer.remove();
  if (below) {
    show(below, main, arrivedAt, page.title);
    return;
  }
  document.querySelector("main")?.replaceWith(main);
  // The opener was replaced along with `main`, so focus goes back to its copy.
  const href = openers.get(layer)?.getAttribute("href");
  const opener =
    href && main.querySelector<HTMLElement>(`a[via-layer][href="${CSS.escape(href)}"]`);
  main.tabIndex = -1;
  (opener || main).focus();
}

function show(layer: HTMLElement, main: HTMLElement, url: URL, title: string) {
  layer.setAttribute("via-layer-url", url.href);
  layer.setAttribute("aria-label", title);
  // The page says how it's shown, so a form can turn from a tooltip into a drawer between steps.
  layer.dataset.type = main.getAttribute("via-layer-type") ?? "dialog";
  placeLayer(layer);
  resolveUrls(main, url);
  // Nested layers stay; only the content is replaced. Its children, so there's one `main`.
  layer.querySelector("[via-layer-content]")?.replaceChildren(...main.childNodes);
  if (!layer.matches(":popover-open")) layer.showPopover({ source: openers.get(layer) });
  (layer.querySelector<HTMLElement>("[autofocus]") ?? layer).focus();
}

/**
 * A tooltip sits where its link's page says, since only that page knows where the link is.
 * Varde reads the same attributes as the edge a drawer slides in from, so other types drop
 * them and a drawer keeps to the right.
 */
function placeLayer(layer: HTMLElement) {
  const opener = layer.dataset.type === "tooltip" ? openers.get(layer) : undefined;
  for (const [attribute, value] of [
    ["data-side", opener?.getAttribute("via-layer-side")],
    ["data-align", opener?.getAttribute("via-layer-align")],
  ] as const)
    if (value) layer.setAttribute(attribute, value);
    else layer.removeAttribute(attribute);
}

/**
 * The layer's content came from another URL, so its relative links and form actions would
 * otherwise resolve against the page's. A form without an action posts to its own page.
 */
function resolveUrls(main: HTMLElement, url: URL) {
  for (const form of main.querySelectorAll("form:not([action]), form[action='']"))
    form.setAttribute("action", url.href);
  for (const [selector, attribute] of [
    ["[href]", "href"],
    ["form[action]", "action"],
    ["[formaction]", "formaction"],
  ] as const)
    for (const element of main.querySelectorAll(selector))
      element.setAttribute(attribute, new URL(element.getAttribute(attribute) ?? "", url).href);
}
