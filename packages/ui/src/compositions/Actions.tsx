import { attributes } from "@tid/via/attributes";
import { classes } from "../primitives/attributes";
import { Button } from "../primitives/Button";
import { Icon, type IconName } from "../primitives/Icon";

/** A link to the form page that does something, like adding or editing. */
export type Action = {
  label: string;
  href: string;
  icon?: IconName;
  /** Names what the action is about when several on a page share a label. */
  "aria-label"?: string;
  /** Opens the form in a layer over the page, shown the way the form's page asks. */
  [attributes.layer]?: boolean;
};

/**
 * Leaves out the actions the user may not take, given as `false`. Actions sit at the right of a
 * header, so a form opened in a tooltip hangs below them, right-aligned, clear of the heading.
 */
export function Actions({
  actions,
  class: className,
}: {
  actions: (Action | false)[];
  class?: string;
}) {
  const allowed = actions.filter((action): action is Action => action !== false);
  if (allowed.length === 0) return null;
  return (
    <div class={classes("stack-h items-center gap-xs", className)}>
      {allowed.map(({ label, href, icon, "aria-label": ariaLabel, [attributes.layer]: layer }) => (
        <Button
          as="a"
          href={href}
          data-variant="filled"
          aria-label={ariaLabel}
          {...(layer && {
            [attributes.layer]: true,
            [attributes.layerSide]: "bottom",
            [attributes.layerAlign]: "right",
          })}
        >
          {icon && <Icon name={icon} />}
          {label}
        </Button>
      ))}
    </div>
  );
}
