import type { Context } from "hono";
import type { FC } from "hono/jsx";
import { PageSearch } from "./filter";
import type { PageUrl } from "./pageUrl";

type StateOf<Url> = Url extends { path: (state: infer State) => string } ? State : never;

/** What a view gets from `queryPage`, typed from the page's `pageUrl`: `QueryProps<typeof <page>Url>`. */
export type QueryProps<Url> = {
  query: StateOf<Url>;
  /** The page with part of its query changed, keeping the rest. */
  href: (change: Partial<StateOf<Url>>) => string;
};

/**
 * One page whose URL says what it shows: GET reads the path and query, 404s an unknown path,
 * redirects a sloppy query to its canonical URL, then renders the view.
 */
export function queryPage<State, P extends object>(opts: {
  url: PageUrl<State>;
  /**
   * Fills in defaults that depend on the request, like the user's own company, before the query is
   * made canonical, so a sloppy URL takes one redirect. Returns a Response (404) to stop.
   */
  complete?: (c: Context, query: State) => Promise<State | Response>;
  /** Runs on the canonical query. Returns the view's props, or a Response (404, redirect) to stop. */
  loader: (c: Context, query: State) => Promise<P | Response>;
  /** Renders the page. Gets the loader's props, plus `query` and `href`. */
  view: FC<P & QueryProps<PageUrl<NoInfer<State>>>>;
}) {
  const View = opts.view;
  return async (c: Context) => {
    const read = opts.url.read(c.req.url);
    if (read === undefined) return c.notFound();
    const query = opts.complete ? await opts.complete(c, read) : read;
    if (query instanceof Response) return query;
    const canonical = opts.url.path(query);
    const requested = new URL(c.req.url);
    if (`${requested.pathname}${requested.search}` !== canonical) return c.redirect(canonical);

    const props = await opts.loader(c, query);
    if (props instanceof Response) return props;
    const href = (change: Partial<State>) => opts.url.path({ ...query, ...change });
    return c.render(
      <PageSearch.Provider value={opts.url.search(query)}>
        <View {...props} query={query} href={href} />
      </PageSearch.Provider>,
    );
  };
}
