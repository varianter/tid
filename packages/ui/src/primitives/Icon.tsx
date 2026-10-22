import { classes, type Props } from "./attributes";

/** The Material Symbols an app serves at `/icons/<name>.svg`, so `Icon` can draw them. */
export const iconNames = [
  "bar_chart",
  "calendar_today",
  "chevron_left",
  "chevron_right",
  "close",
  "domain",
  "error",
  "event_available",
  "folder",
  "group",
  "menu",
  "settings",
  "table",
  "thumb_down",
  "thumb_up",
] as const;

export type IconName = (typeof iconNames)[number];

/** A decorative Material Symbol drawn in the current text color. */
export function Icon({ name, class: className, ...attributes }: Props<"span", { name: IconName }>) {
  return (
    <span
      class={classes("v-icon", className)}
      // Set via --icon-src, a relative URL would resolve against Varde's stylesheet.
      style={`mask-image: url('/icons/${name}.svg')`}
      aria-hidden="true"
      {...attributes}
    />
  );
}
