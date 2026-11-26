import type { Child, PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import type { PopoverType } from "../primitives/Popover";
import { type Action, Actions } from "./Actions";
import { PageFrame } from "./PageFrame";

type PageProps = PropsWithChildren<{
  title: string;
  /** A line under the title about what the page shows, such as an email or a status. */
  description?: Child;
  back?: { href: string; label: string };
  /** Links to forms. Filters sit with the data they narrow. */
  actions?: (Action | false)[];
  /** The month or year everything on the page shows, such as a `PeriodNavigation`. */
  period?: Child;
  /** How the page is shown when it's opened in a layer. Without one, `@tid/via` shows a drawer. */
  layer?: PopoverType;
}>;

export function Page({ title, description, back, actions, period, layer, children }: PageProps) {
  const heading = (
    <div class="stack-v gap-3xs">
      <h1 class="fs-xl fw-bold">{title}</h1>
      {description && <p class="stack-h items-center gap-xs ink-subtle">{description}</p>}
    </div>
  );
  return (
    <PageFrame component="Page" title={title} layer={layer} class="px-s-m pb-l">
      <header class="stack-v gap-s -mx-s-m mb-l p-s-m pb-s">
        {back && (
          <Button
            as="a"
            href={back.href}
            data-variant="plain"
            data-size="small"
            class="self-start -ml-xs"
          >
            <Icon name="chevron_left" />
            {back.label}
          </Button>
        )}
        <div class="stack-h items-end gap-m">
          {heading}
          {actions && <Actions actions={actions} class="ml-auto" />}
        </div>
        {period && <div class="stack-h wrap items-center gap-m ">{period}</div>}
      </header>
      <div data-transition="content" class="stack-v flex-nowrap gap-xl">
        {children}
      </div>
    </PageFrame>
  );
}
