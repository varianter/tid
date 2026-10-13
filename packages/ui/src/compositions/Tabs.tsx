import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "../primitives/attributes";
import { Button } from "../primitives/Button";

function TabList({ class: className, ...attributes }: PropsWithChildren<Props<"nav">>) {
  return <nav class={classes("b-all br-l gap-xs p-3xs stack-h", className)} {...attributes} />;
}

function TabLink({ href, active, children }: PropsWithChildren<{ href: string; active: boolean }>) {
  return (
    <Button
      as="a"
      href={href}
      aria-current={active ? "page" : undefined}
      class="flex-1"
      data-size="small"
      data-variant={active ? undefined : "plain"}
    >
      {children}
    </Button>
  );
}

export const Tabs = Object.assign(TabList, { Link: TabLink });
