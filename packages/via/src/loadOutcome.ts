/** What a layer and the response it loaded say about where the response goes. */
export type LoadFacts = {
  /** Where the response landed, after any redirect. */
  url: URL;
  /** What the layer shows, or null while it loads its first page. */
  shownUrl: URL | null;
  /** What the layer below shows, or the page itself. */
  belowUrl: URL;
  closed: boolean;
  /** A form with `via-leave-layer` was submitted. */
  leavesLayer: boolean;
};

/**
 * Where a layer puts the page it loaded: `stay` shows it in the layer, `openNext` in a layer of its
 * own, and `accept` closes the layer and shows it in whatever is below. `reload` loads it as the
 * whole page, and `ignore` drops it.
 */
export type LoadOutcome = "stay" | "openNext" | "accept" | "reload" | "ignore";

export function outcomeOfLoad(facts: LoadFacts): LoadOutcome {
  // Closed while it loaded, so what it loaded is no longer wanted.
  if (facts.shownUrl && facts.closed) return "ignore";
  // A failed submission comes back to its own page, and stays in its layer.
  const samePage = facts.shownUrl?.pathname === facts.url.pathname;
  // The submission went through. Only a page load puts the page it ends on in the address bar.
  if (facts.leavesLayer && !samePage) return "reload";
  if (isAccepted(facts.url, facts.belowUrl)) return "accept";
  return facts.shownUrl && !samePage ? "openNext" : "stay";
}

/**
 * A layer is accepted when it arrives back where the layer below is, like a command redirecting
 * to the page it was opened from. Paths only, since a redirect back may add a query.
 */
function isAccepted(url: URL, belowUrl: URL) {
  return url.pathname === belowUrl.pathname;
}
