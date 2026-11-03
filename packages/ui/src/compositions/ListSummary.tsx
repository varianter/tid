/** A list this short is written out in full; collapsing it would hide names without saving room. */
const shortestCollapsedLength = 4;

/**
 * Names the first `shown` items and counts the rest ("Oslo +3 more"), so a list of any length
 * fits a table cell. Lists of up to three are written out in full.
 */
export function ListSummary({ items, shown = 1 }: { items: string[]; shown?: number }) {
  if (items.length < shortestCollapsedLength) return <>{items.join(", ")}</>;
  return (
    <>
      {items.slice(0, shown).join(", ")} +{items.length - shown} more
    </>
  );
}
