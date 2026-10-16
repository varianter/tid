import type { PropsWithChildren } from "hono/jsx";
import type { Props } from "./attributes";

export type Palette =
  | "inherit"
  | "grey"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "coral"
  | "purple"
  | "teal"
  | "periwinkle";

/** Colors everything inside it. `inverted` flips the light and dark ends of the palette. */
export function ColorMode({
  palette,
  inverted,
  ...attributes
}: PropsWithChildren<Props<"div", { palette?: Palette; inverted?: boolean; role?: string }>>) {
  return <color-mode palette={palette} inverted={inverted} {...attributes} />;
}
