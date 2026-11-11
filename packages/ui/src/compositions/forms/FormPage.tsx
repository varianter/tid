import type { Child, PropsWithChildren } from "hono/jsx";
import { classes } from "../../primitives/attributes";
import type { PopoverType } from "../../primitives/Popover";
import { PageFrame } from "../PageFrame";

type FormPageProps = PropsWithChildren<{
  title: string;
  /** A line under the title about what the form changes. */
  description?: Child;
  /** How the page is shown when it's opened in a layer. Without one, `@tid/via` shows a drawer. */
  layer?: PopoverType;
  /** The widest the page gets, as a step on Varde's width scale. */
  width?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}>;

/**
 * The page an action opens, as opposed to a `Page` that shows something. It holds a `Form`, or,
 * when there's nothing to do, why not and a `ReturnLink`.
 */
export function FormPage({ title, description, layer, width, children }: FormPageProps) {
  return (
    <PageFrame
      component="FormPage"
      form
      title={title}
      layer={layer}
      class={classes("px-s-m py-m", width === undefined ? undefined : `w-max-${width}`)}
      style="min-width: min(55ch, 90svw);"
    >
      <header class="-mt-m -mx-s-m b-b bc-subtle gap-4xs mb-s px-s-m py-2xs stack-v surface-tinted">
        <h1 class="fs-m fw-medium">{title}</h1>
        {description && <p class="ink-subtle">{description}</p>}
      </header>
      <div class="stack-v flex-nowrap gap-l">{children}</div>
    </PageFrame>
  );
}
