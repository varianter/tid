import { Button } from "@tid/ui";
import { type Child, createContext, type PropsWithChildren, useContext } from "hono/jsx";

const InsideFiltered = createContext(false);

/** The page's query, so a filter can submit the rest of it alongside its own field. Provide it around a page with filters. */
export const PageSearch = createContext(new URLSearchParams());

export const usePageSearch = () => useContext(PageSearch);

/**
 * Filters above the part of the page they narrow. A filter that changes everything on the page,
 * like its organization or month, wraps all of the page's content.
 */
export function Filtered({ by, children }: PropsWithChildren<{ by: Child }>) {
  return (
    <InsideFiltered.Provider value={true}>
      <div class="stack-v nowrap gap-m">
        <div class="stack-h wrap gap-m py-4xs b-all bc-subtle br-l surface-tinted pl-2xs pr-4xs">
          {by}
        </div>
        {children}
      </div>
    </InsideFiltered.Provider>
  );
}

/**
 * A form that changes `field` in the page's query, keeping the rest. It submits on change. It
 * belongs to a `Filtered`, so it sits with the data it narrows.
 */
export function FilterForm({ field, children }: PropsWithChildren<{ field: string }>) {
  if (!useContext(InsideFiltered)) throw new Error(`The ${field} filter is outside a Filtered`);
  return (
    <auto-submit>
      <form method="get" class="stack-h nowrap gap-3xs br-m p-4xs">
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
