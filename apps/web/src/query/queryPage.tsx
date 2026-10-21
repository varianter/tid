import { Button } from "@tid/ui";
import type { Context } from "hono";
import { createContext, type FC, type PropsWithChildren, useContext } from "hono/jsx";
import type { PageUrl } from "./pageUrl";

// The page's canonical query, so a filter form can submit the rest of it alongside its own field.
const PageSearch = createContext(new URLSearchParams());

export const usePageSearch = () => useContext(PageSearch);

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
  /** Runs on the canonical query. Returns the view's props, or a Response (404, redirect) to stop. */
  loader: (c: Context, query: State) => Promise<P | Response>;
  /** Renders the page. Gets the loader's props, plus `query` and `href`. */
  view: FC<P & QueryProps<PageUrl<NoInfer<State>>>>;
}) {
  const View = opts.view;
  return async (c: Context) => {
    const query = opts.url.read(c.req.url);
    if (query === undefined) return c.notFound();
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

/** A form that changes `field` in the page's query, keeping the rest. It submits on change. */
export function FilterForm({ field, children }: PropsWithChildren<{ field: string }>) {
  return (
    <auto-submit>
      <form method="get" class="stack-v nowrap gap-3xs">
        {[...usePageSearch()].map(([name, value]) =>
          name === field ? null : <input type="hidden" name={name} value={value} />,
        )}
        {children}
        <noscript>
          <Button type="submit" data-size="small">
            Show
          </Button>
        </noscript>
      </form>
    </auto-submit>
  );
}
