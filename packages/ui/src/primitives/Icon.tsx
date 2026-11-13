import { classes, type Props } from "./attributes";
import { type IconName, iconNames } from "./iconNames";

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

/**
 * A Material Symbol drawn in the current text color. Decorative unless given a `label`, which it
 * needs when nothing beside it says the same.
 */
export function Icon({
  name,
  label,
  class: className,
  style = "",
  ...attributes
}: Props<"span", { name: IconName; label?: string }>) {
  return (
    <span
      class={classes("v-icon", className)}
      // Set via --icon-src, a relative URL would resolve against Varde's stylesheet.
      style={`mask-image: url('${iconsPath}/${icons.get(name)?.fileName}'); ${style}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
      {...attributes}
    />
  );
}
