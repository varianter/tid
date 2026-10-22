import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props, type Sized } from "./attributes";

export function Select({
  class: className,
  ...attributes
}: PropsWithChildren<Props<"select", Sized>>) {
  // `v-select` is a customizable select, so label an `<optgroup>` with a `<legend>` child, not its
  // `label` attribute — the legend is easier to target and style, with the same semantics.
  return <select class={classes("v-select", className)} {...attributes} />;
}
