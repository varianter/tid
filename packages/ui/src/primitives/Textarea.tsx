import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props, type Sized } from "./attributes";

export function Textarea({
  class: className,
  ...attributes
}: PropsWithChildren<Props<"textarea", Sized>>) {
  return <textarea class={classes("v-textarea", className)} {...attributes} />;
}
