import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props } from "./attributes";

type TableData = { "data-density"?: "compact" | "default" | "relaxed" };

export function Table({
  class: className,
  ...attributes
}: PropsWithChildren<Props<"table", TableData>>) {
  return <table class={classes("v-table", className)} {...attributes} />;
}
