import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "./attributes";
import { ColorMode, type Palette } from "./ColorMode";

/** A short status next to a value, such as "Current". */
export function Badge({
  palette = "inherit",
  class: className,
  ...attributes
}: PropsWithChildren<Props<"span", { palette?: Palette }>>) {
  return (
    <ColorMode palette={palette}>
      <span
        class={classes("b-all br-s fs-xs ink-prominent px-3xs py-3xs surface-tinted", className)}
        {...attributes}
      />
    </ColorMode>
  );
}
