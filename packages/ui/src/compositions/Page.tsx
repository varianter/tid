import { attributes } from "@tid/via/attributes";
import type { Child, PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import type { PopoverType } from "../primitives/Popover";
import { type Action, Actions } from "./Actions";

type PageProps = PropsWithChildren<{
  title: string;
  /** A line under the title about what the page shows, such as an email or a status. */
  description?: Child;
  back?: { href: string; label: string };
  /** Links to forms, the only thing in the header. Filters sit with the data they narrow. */
  actions?: (Action | false)[];
  /** How the page is shown when it's opened in a layer. Without one, `@tid/via` shows a dialog. */
  layer?: PopoverType;
}>;

export function Page({ title, description, back, actions, layer, children }: PageProps) {
  const heading = (
    <div class="stack-v gap-3xs">
      <h1 class="fs-xl fw-bold">{title}</h1>
      {description && <p class="stack-h items-center gap-xs ink-subtle">{description}</p>}
    </div>
  );
  return (
    // A layer takes only the box, so `main`'s padding is what a page has beyond a layer's.
    <main composite-component="Page">
      {/* Hono moves a title rendered in the body into the head. */}
      <title>{title}</title>
      <div class="px-s-m pb-l" {...{ [attributes.layerType]: layer }}>
        <header class="stack-v gap-2xs -mx-s-m mb-s p-s-m pb-s surface-tinted b-b bc-subtle br-xl br-bl-none br-br-none">
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
        </header>
        <div data-transition="content" class="stack-v flex-nowrap gap-xl">
          {children}
        </div>
      </div>
    </main>
  );
}
