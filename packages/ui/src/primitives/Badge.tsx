import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "./attributes";

/** A short status next to a value, such as "Current". */
export function Badge({ class: className, ...attributes }: PropsWithChildren<Props<"span">>) {
  return (
    <span
      class={classes("b-all br-s fs-xs ink-prominent px-3xs py-3xs surface-tinted", className)}
      {...attributes}
    />
  );
}
