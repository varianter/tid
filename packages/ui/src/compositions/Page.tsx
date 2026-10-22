import type { Child, PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";

type PageProps = PropsWithChildren<{
  title: string;
  /** A line under the title about what the page shows, such as an email or a status. */
  description?: Child;
  back?: { href: string; label: string };
  actions?: Child;
}>;

export function Page({ title, description, back, actions, children }: PageProps) {
  const heading = (
    <div class="stack-v gap-3xs">
      <h1 class="fs-xl fw-bold">{title}</h1>
      {description && <p class="stack-h items-center gap-xs ink-subtle">{description}</p>}
    </div>
  );
  return (
    <main composite-component="Page" class="py-xl px-s">
      {/* Hono moves a title rendered in the body into the head. */}
      <title>{title}</title>
      <header class="b-b bc-subtle gap-2xs pb-s stack-h mb-s">
        {/* The actions share the top row, which is the back link when there is one. */}
        <div class="stack-h items-end gap-m flex-1">
          {back ? (
            <Button as="a" href={back.href} data-variant="plain" data-size="small">
              <Icon name="chevron_left" />
              {back.label}
            </Button>
          ) : (
            heading
          )}
          {actions && <div class="ml-auto stack-h items-center gap-m ml-auto">{actions}</div>}
        </div>
        {back && heading}
      </header>
      <div data-transition="content" class="stack-v nowrap gap-xl">
        {children}
      </div>
    </main>
  );
}
