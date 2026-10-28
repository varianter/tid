import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "./attributes";

type FieldsetProps = PropsWithChildren<Props<"fieldset", { legend?: string }>>;

/**
 * A titled group of form controls. Pass `legend` for a plain heading, or `Fieldset.Legend` when
 * the legend needs its own styling or content.
 */
function FieldsetBase({ legend, class: className, children, ...attributes }: FieldsetProps) {
  return (
    <fieldset
      composite-component="Fieldset"
      class={classes("stack-v gap-m w-full", className)}
      {...attributes}
    >
      {legend !== undefined && <Legend>{legend}</Legend>}
      {children}
    </fieldset>
  );
}

function Legend({ class: className, ...attributes }: PropsWithChildren<Props<"legend">>) {
  return (
    <legend
      composite-component="Fieldset.Legend"
      class={classes("fs-l fw-medium mb-s", className)}
      {...attributes}
    />
  );
}

export const Fieldset = Object.assign(FieldsetBase, { Legend });
