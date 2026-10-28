// What a page and via say to each other. The server renders these and via reads them, so both
// import them from here and a rename reaches every side.
export const attributes = {
  /** On a link: opens its page in a layer over this one. */
  layer: "via-layer",
  /** On a layer link: the side of the link a tooltip layer sits on. */
  layerSide: "via-layer-side",
  /** On a layer link: how a tooltip layer lines up with the link. */
  layerAlign: "via-layer-align",
  /** On a link in a layer: closes the layer and loads nothing. */
  dismiss: "via-dismiss",
  /** On a form in a layer: once it goes through, the page it ends on replaces the whole page. */
  leaveLayer: "via-leave-layer",
  /** On the box directly inside a page's `main`: the Varde popover type its layer takes. */
  layerType: "via-layer-type",
  /** In the layer template: the element each loaded page goes into. */
  layerContent: "via-layer-content",
  /** Set by via on a layer once it shows a page: that page's URL. */
  layerUrl: "via-layer-url",
} as const;

/** The id of the `template` each layer is cloned from. */
export const layerTemplateId = "via-layer-template";
