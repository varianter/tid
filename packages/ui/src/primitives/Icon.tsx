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
  "domain",
  "error",
  "event_available",
  "folder",
  "group",
  "lock",
  "lock_open",
  "menu",
  "settings",
  "table",
  "thumb_down",
  "thumb_up",
] as const;

export type IconName = (typeof iconNames)[number];

const iconsDirectory = `${import.meta.dir}/../../icons`;
const iconsHash = Bun.hash(
  (
    await Promise.all(iconNames.map((name) => Bun.file(`${iconsDirectory}/${name}.svg`).text()))
  ).join(),
).toString(36);

/** Where the app serves the icons. The path holds a hash, so they can be cached forever. */
export const iconsPath = `/icons/${iconsHash}`;

/** The icon file named `<name>.svg`, if it is one of the icons. */
export function findIconFile(fileName: string) {
  const name = iconNames.find((name) => `${name}.svg` === fileName);
  return name && Bun.file(`${iconsDirectory}/${name}.svg`);
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
      style={`mask-image: url('${iconsPath}/${name}.svg'); ${style}`}
      aria-hidden="true"
      {...attributes}
    />
  );
}
