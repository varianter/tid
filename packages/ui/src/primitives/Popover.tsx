import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "./attributes";

/** How a popover presents itself. */
export type PopoverType = "dialog" | "drawer" | "tooltip";

type PopoverData = {
  "data-type"?: PopoverType;
  "data-side"?: "top" | "right" | "bottom" | "left";
  "data-align"?: "left" | "center" | "right";
  "data-backdrop"?: boolean;
  // Hono's types leave out `role`.
  role?: "dialog";
};

export function Popover({
  class: className,
  popover = "auto",
  ...attributes
}: PropsWithChildren<Props<"div", PopoverData>>) {
  return <div class={classes("v-popover", className)} popover={popover} {...attributes} />;
}
