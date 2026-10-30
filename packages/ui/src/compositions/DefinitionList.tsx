import { classes, type Props } from "../primitives/attributes";

/** One line of a `SummaryList`: what it names, and every value it names. */
export type SummaryListRow = {
  label: string;
  values: string[];
};

/**
 * A `<dl>` of what something is about, one line per label, the values in a second column.
 * Several values sit under each other in that column. A falsy row is dropped, so
 * `showTo && { … }` hides it with its label.
 */
export function SummaryList({
  rows,
  class: className,
  ...attributes
}: Props<"dl", { rows: (SummaryListRow | false)[] }>) {
  const shown = rows.filter((row) => row !== false && row != null);
  return (
    <dl
      composite-component="SummaryList"
      {...attributes}
      class={classes("d-grid surface-base b-all bc-subtle br-l of-clip", className)}
      style="grid-template-columns: 6rem 1fr;"
    >
      {shown.map((row) => (
        <div class="grid-subgrid grid-all-columns items-start gap-row-3xs b-b bc-subtle b-none:last-child px-s py-2xs">
          <dt class="fs-s ink-subtle">{row.label}</dt>
          {row.values.map((value) => (
            <dd class="fw-medium" style="grid-column: 2;">
              {value}
            </dd>
          ))}
        </div>
      ))}
    </dl>
  );
}
