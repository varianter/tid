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
};

/** Leaves out the actions the user may not take, given as `false`. */
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
      {allowed.map(({ label, href, icon, "aria-label": ariaLabel }) => (
        <Button as="a" href={href} data-variant="tinted" aria-label={ariaLabel}>
          {icon && <Icon name={icon} />}
          {label}
        </Button>
      ))}
    </div>
  );
}
