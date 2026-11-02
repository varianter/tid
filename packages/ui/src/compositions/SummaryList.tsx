import { attributes as viaAttributes } from "@tid/via/attributes";
import { classes, type Props } from "../primitives/attributes";
import type { Action } from "./Actions";

/** One line of a `SummaryList`: what it names, every value it names, and how to change them. */
export type SummaryListRow = {
  label: string;
  values: string[];
  /** A link beside the values, left out when the user may not take it. */
  action?: Action | false;
};

/**
 * A `<dl>` of what something is about, one line per label, the values in a second column.
 * Several values sit under each other in that column. A falsy row is dropped, so
 * `showTo && { … }` hides it with its label. Row actions get a third column of their own.
 */
export function SummaryList({
  rows,
  class: className,
  columnSize = "minmax(6rem, max-content) 1fr",
  ...attributes
}: Props<"dl", { columnSize?: string; rows: (SummaryListRow | false)[] }>) {
  const shown = rows.filter((row) => row !== false && row != null);
  const hasActions = shown.some((row) => row.action);
  return (
    <dl
      composite-component="SummaryList"
      {...attributes}
      class={classes("d-grid surface-base b-all bc-subtle br-l of-clip gap-column-xs", className)}
      style={`grid-template-columns: ${columnSize}${hasActions ? " max-content" : ""};`}
    >
      {shown.map((row) => (
        <div class="grid-subgrid grid-all-columns items-start gap-row-3xs b-b bc-subtle b-none:last-child px-s py-2xs">
          <dt class="fs-s ink-subtle lh-snug">{row.label}</dt>
          {row.values.map((value) => (
            <dd class="fw-medium lh-snug" style="grid-column: 2;">
              {value}
            </dd>
          ))}
          {row.action && <RowAction {...row.action} />}
        </div>
      ))}
    </dl>
  );
}

function RowAction({ label, href, "aria-label": ariaLabel, [viaAttributes.layer]: layer }: Action) {
  return (
    <dd style="grid-column: 3; grid-row: 1;">
      <a
        class="v-link fs-s"
        href={href}
        aria-label={ariaLabel}
        {...(layer && {
          [viaAttributes.layer]: true,
          [viaAttributes.layerSide]: "bottom",
          [viaAttributes.layerAlign]: "right",
        })}
      >
        {label}
      </a>
    </dd>
  );
}
