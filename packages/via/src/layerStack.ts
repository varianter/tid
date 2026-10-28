// Creates, nests and closes the layers a page opens. A layer is a clone of the page's layer
// template. Nested layers sit inside their parent, so the native popover stack keeps the parent
// open and closes them along with it.
import { attributes, layerTemplateId } from "./attributes";

/** A layer counts as one once it shows a page; until its first page loads it has no URL. */
export const layerSelector = `[${attributes.layerUrl}]`;

// The link each layer was opened from. A tooltip is placed next to it, and the next layer keeps it.
const openers = new WeakMap<HTMLElement, HTMLElement>();

export function openerOf(layer: HTMLElement) {
  return openers.get(layer);
}

export function openLayer(opener: HTMLAnchorElement) {
  const layer = createLayer(opener);
  (opener.closest(layerSelector) ?? document.body).append(layer);
  return layer;
}

/** A step to another page is a layer of its own: the previous one closes as the next opens. */
export function openNextLayer(previous: HTMLElement) {
  const opener = openers.get(previous);
  if (!opener) throw new Error("A layer was opened without a link");
  const layer = createLayer(opener);
  previous.after(layer);
  previous.hidePopover();
  return layer;
}

function createLayer(opener: HTMLElement) {
  const template = document.getElementById(layerTemplateId);
  const layer =
    template instanceof HTMLTemplateElement && template.content.firstElementChild?.cloneNode(true);
  if (!(layer instanceof HTMLElement)) {
    throw new Error(`The page has no template#${layerTemplateId}`);
  }
  openers.set(layer, opener);
  // ponytail: a click outside closes the layer and loses what was typed in it. A <dialog> with
  // closedby="closerequest" keeps it, once layers can be dialogs.
  layer.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState !== "closed") return;
    // Removed once it has finished closing, so its closing animation plays.
    const closing = layer.getAnimations({ subtree: true }).map((animation) => animation.finished);
    void Promise.allSettled(closing).then(() => layer.remove());
  });
  return layer;
}
