import type { Context } from "hono";

const thisSite = "http://this.site";

/**
 * The `returnTo` page a form goes back to once it's done, with `query` added. Only a path on this
 * site, so a crafted link can't send someone elsewhere after they submit.
 */
export function returnTo(c: Context, query: Record<string, string> = {}) {
  const path = c.req.query("returnTo");
  if (!path?.startsWith("/")) return undefined;
  if (new URL(path, thisSite).origin !== thisSite) return undefined;
  return withQuery(path, query);
}

/** `path` with `query` added to whatever query it already has. */
export function withQuery(path: string, query: Record<string, string>) {
  const url = new URL(path, thisSite);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url.pathname + url.search;
}
