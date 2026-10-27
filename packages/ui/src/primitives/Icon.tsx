import { classes, type Props } from "./attributes";

/* To find an icon and its name:
 * 1. go to https://fonts.google.com/icons?icon.style=Rounded
 * 2. click an icon and it should open a drawer with informaton.
 * 3. Scroll to the bottom of the drawer and copy the Icon name
 * 4. Insert in the array below and run `download-icons` from package root.
 * 5. Icon is downloaded to `./icons`. Profit!
 *
 * It is worth noting that the SVG will indeed be added to git. At this point, we're really OK with this.
 * If this becomes a problem, it could move to runtime instead. Fetch when needed and then stored.
 **/

export const iconNames = [
  "bar_chart",
  "calendar_today",
  "chevron_left",
  "chevron_right",
  "close",
  "dark_mode",
  "domain",
  "error",
  "event_available",
  "folder",
  "group",
  "light_mode",
  "lock",
  "lock_open",
  "menu",
  "settings",
  "table",
  "thumb_down",
  "thumb_up",
] as const;

export type IconName = (typeof iconNames)[number];

/** Where the app serves the icons. */
export const iconsPath = "/icons";

// Each file name holds a hash of its SVG, so the icon can be cached forever.
const icons = new Map(
  await Promise.all(
    iconNames.map(async (name) => {
      const svg = await Bun.file(`${import.meta.dir}/../../icons/${name}.svg`).text();
      return [name, { fileName: `${name}-${Bun.hash(svg).toString(36)}.svg`, svg }] as const;
    }),
  ),
);

/** The SVG served as `fileName`, if it is one of the icons. */
export function findIconSvg(fileName: string) {
  return icons.values().find((icon) => icon.fileName === fileName)?.svg;
}

/** A decorative Material Symbol drawn in the current text color. */
export function Icon({
  name,
  class: className,
  style = "",
  ...attributes
}: Props<"span", { name: IconName }>) {
  return (
    <span
      class={classes("v-icon", className)}
      // Set via --icon-src, a relative URL would resolve against Varde's stylesheet.
      style={`mask-image: url('${iconsPath}/${icons.get(name)?.fileName}'); ${style}`}
      aria-hidden="true"
      {...attributes}
    />
  );
}
