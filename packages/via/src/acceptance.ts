/**
 * Whether a layer that arrived at `url` is done, handing back to the layer below it: it arrived
 * back where that layer is, like a command redirecting to the page it was opened from.
 * Paths only, since a redirect back may add a query.
 */
export function isAccepted(url: URL, belowUrl: URL) {
  return url.pathname === belowUrl.pathname;
}
