import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "./attributes";

export function Label({ class: className, ...attributes }: PropsWithChildren<Props<"label">>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: the caller passes `for` or nests the control.
  return <label class={classes("v-form-label", className)} {...attributes} />;
}
