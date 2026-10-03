import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "./attributes";

type PopoverData = {
  "data-type"?: "dialog" | "drawer" | "tooltip";
  "data-position"?: "top" | "right" | "bottom" | "left";
  "data-backdrop"?: boolean;
};

export function Popover({
  class: className,
  popover = "auto",
  ...attributes
}: PropsWithChildren<Props<"div", PopoverData>>) {
  return <div class={classes("v-popover", className)} popover={popover} {...attributes} />;
}
