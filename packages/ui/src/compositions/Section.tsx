import type { Child, PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "../primitives/attributes";

type SectionProps = PropsWithChildren<
  Props<
    "section",
    {
      title: string;
      /** Shown at the end of the heading's row. */
      actions?: Child;
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
        {actions}
      </div>
      {children}
    </section>
  );
}
