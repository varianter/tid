import type { Context } from "hono";

const thisSite = "http://this.site";

/**
 * The `returnTo` page a form goes back to once it's done, with `query` added. Only a path on this
 * site, so a crafted link can't send someone elsewhere after they submit.
 */
export function returnTo(c: Context, query: Record<string, string> = {}) {
  const path = c.req.query("returnTo");
  if (!path?.startsWith("/")) return undefined;
  const url = new URL(path, thisSite);
  if (url.origin !== thisSite) return undefined;
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url.pathname + url.search;
}
