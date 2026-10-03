import type { Child, PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";

type PageProps = PropsWithChildren<{
  title: string;
  back?: { href: string; label: string };
  actions?: Child;
}>;

export function Page({ title, back, actions, children }: PageProps) {
  const heading = <h1 class="fs-m">{title}</h1>;
  return (
    <main class="p-xl stack-v nowrap gap-xl">
      <header class="stack-v gap-2xs">
        {/* The actions share the top row, which is the back link when there is one. */}
        <div class="stack-h items-center gap-m">
          {back ? (
            <Button as="a" href={back.href} data-variant="plain" data-size="small">
              <div class="v-icon" data-v-icon="chevron-left" />
              {back.label}
            </Button>
          ) : (
            heading
          )}
          {actions && <div class="stack-h items-center gap-m ml-auto">{actions}</div>}
        </div>
        {back && heading}
      </header>
      {children}
    </main>
  );
}
