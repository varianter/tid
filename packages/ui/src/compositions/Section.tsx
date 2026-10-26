import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "../primitives/attributes";
import { type Action, Actions } from "./Actions";

type SectionProps = PropsWithChildren<
  Props<
    "section",
    {
      title: string;
      /** Links to forms about this section, at the end of the heading's row. */
      actions?: (Action | false)[];
    }
  >
>;

/**
 * A titled part of a `Page`, one heading level below the page's title. When it has nothing to
 * show, say so in a sentence rather than an `EmptyState`.
 */
export function Section({
  title,
  actions,
  class: className,
  children,
  ...attributes
}: SectionProps) {
  return (
    <section
      composite-component="Section"
      class={classes("stack-v gap-s", className)}
      {...attributes}
    >
      <div class="stack-h items-center justify-between gap-m wrap">
        <h2 class="fs-l fw-bold">{title}</h2>
        {actions && <Actions actions={actions} />}
      </div>
      {children}
    </section>
  );
}
