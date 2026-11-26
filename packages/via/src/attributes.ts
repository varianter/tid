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
  /**
   * On a page's `main`: the page is a form. A submission that ends on it stays in a layer, as the
   * next step. One that ends on any other page, other than the one below, leaves for it.
   */
  formPage: "via-form-page",
  /** On the box directly inside a page's `main`: the Varde popover type its layer takes. */
  layerType: "via-layer-type",
  /** In the layer template: the element each loaded page goes into. */
  layerContent: "via-layer-content",
  /** Set by via on a layer once it shows a page: that page's URL. */
  layerUrl: "via-layer-url",
  /**
   * Marks an element outside `main` that should still update when via loads a page. Give it an
   * id. On each load, via copies the content of the loaded page's element with that id into this
   * one, as a full page load would. Like `hx-swap-oob` in htmx.
   */
  outOfBand: "via-out-of-band",
} as const;

/** The id of the `template` each layer is cloned from. */
export const layerTemplateId = "via-layer-template";
