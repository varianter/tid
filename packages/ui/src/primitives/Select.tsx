import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props, type Sized } from "./attributes";

export function Select({
  class: className,
  ...attributes
}: PropsWithChildren<Props<"select", Sized>>) {
  return <select class={classes("v-select", className)} {...attributes} />;
}
