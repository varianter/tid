// Turns the navigations a page makes into layer navigations, so links and forms in a layer stay
// in it until it's accepted or dismissed. The address bar never changes. Outside a layer, only a
// `via-layer` link is taken over; every other link is left to the browser.

import { attributes } from "./attributes";
import { layerSelector, openLayer } from "./layerStack";
import { loadIntoLayer } from "./loadIntoLayer";

export type NavigationRoute = "browser" | "dismiss" | "openLayer" | "loadIntoLayer";

/** What the browser says about a navigation, and where its source sits. */
export type NavigationFacts = {
  /** A push or replace from a link or form, which the browser lets us take over. */
  interceptable: boolean;
  /** The link or form has a `target` that isn't `_self`. */
  opensElsewhere: boolean;
  /** Inside a `via-dismiss` link. */
  dismisses: boolean;
  /** Inside a `via-layer` link, which opens a layer of its own. */
  opensLayer: boolean;
  inLayer: boolean;
};

const layerLinkSelector = `a[${attributes.layer}]`;

/**
 * Where a navigation goes. A `via-dismiss` link outside a layer has nothing to close, so the
 * browser follows it.
 */
export function routeNavigation(facts: NavigationFacts): NavigationRoute {
  if (!facts.interceptable || facts.opensElsewhere) return "browser";
  if (facts.dismisses) return facts.inLayer ? "dismiss" : "browser";
  if (facts.opensLayer) return "openLayer";
  return facts.inLayer ? "loadIntoLayer" : "browser";
}

export function isInterceptable(
  event: Pick<
    NavigateEvent,
    "navigationType" | "cancelable" | "canIntercept" | "hashChange" | "downloadRequest"
  >,
) {
  const isPushOrReplace = event.navigationType === "push" || event.navigationType === "replace";
  return (
    event.cancelable &&
    event.canIntercept &&
    isPushOrReplace &&
    !event.hashChange &&
    event.downloadRequest === null
  );
}

export function listenForNavigations() {
  document.addEventListener("click", (event) => rememberSource(event.target), { capture: true });
  document.addEventListener("submit", (event) => rememberSource(event.submitter ?? event.target), {
    capture: true,
  });
  navigation.addEventListener("navigate", onNavigate);
}

// A click or submit navigates within the same task, so the source is forgotten after it and
// can't be mistaken for the source of a later navigation.
let lastSource: Element | null = null;
function rememberSource(source: EventTarget | null) {
  lastSource = source instanceof Element ? source : null;
  setTimeout(() => (lastSource = null));
}

function onNavigate(event: NavigateEvent) {
  // ponytail: lastSource stands in for sourceElement until every browser we support has it.
  const source = event.sourceElement ?? lastSource;
  if (!source) return;
  const route = routeNavigation(navigationFacts(event, source));
  if (route === "browser") return;
  if (route === "dismiss") return dismiss(event, source);

  const layer =
    route === "openLayer" ? openLayerFrom(source) : source.closest<HTMLElement>(layerSelector);
  if (!layer) return;
  event.preventDefault();
  if (event.formData) submitFromLayer(layer, event.destination.url, event.formData, formOf(source));
  else void loadIntoLayer(layer, event.destination.url, {});
}

function navigationFacts(event: NavigateEvent, source: Element): NavigationFacts {
  return {
    interceptable: isInterceptable(event),
    opensElsewhere: opensElsewhere(source),
    dismisses: Boolean(source.closest(`[${attributes.dismiss}]`)),
    opensLayer: Boolean(source.closest(layerLinkSelector)),
    inLayer: Boolean(source.closest(layerSelector)),
  };
}

function openLayerFrom(source: Element) {
  const opener = source.closest<HTMLAnchorElement>(layerLinkSelector);
  return opener && openLayer(opener);
}

/**
 * A link with `via-dismiss` closes its layer and loads nothing, so the layer below keeps what was
 * typed in it.
 */
function dismiss(event: NavigateEvent, source: Element) {
  const layer = source.closest<HTMLElement>(layerSelector);
  if (!layer) return;
  event.preventDefault();
  layer.hidePopover();
}

/**
 * A form is busy until its submission has loaded, and a second press doesn't post it twice.
 * One with `via-leave-layer` ends on a page of its own, which replaces the whole page.
 */
function submitFromLayer(
  layer: HTMLElement,
  url: string,
  body: FormData,
  form: HTMLFormElement | null,
) {
  if (form?.getAttribute("aria-busy") === "true") return;
  form?.setAttribute("aria-busy", "true");
  const leavesLayer = Boolean(form?.hasAttribute(attributes.leaveLayer));
  loadIntoLayer(layer, url, { method: "POST", body }, { leavesLayer })
    // ponytail: a failed submission shows nothing; a visible error needs a design for the layer.
    .catch((error) => console.error(error))
    .finally(() => form?.removeAttribute("aria-busy"));
}

function isSubmitter(source: Element) {
  return source instanceof HTMLButtonElement || source instanceof HTMLInputElement;
}

function formOf(source: Element) {
  if (isSubmitter(source)) return source.form;
  return source instanceof HTMLFormElement ? source : null;
}

/** A link or form with a `target`, like `_blank`, goes where the browser sends it. */
function opensElsewhere(source: Element) {
  const formTarget = isSubmitter(source) ? source.formTarget : "";
  const target = formTarget || formOf(source)?.target || source.closest("a")?.target;
  return Boolean(target) && target !== "_self";
}
