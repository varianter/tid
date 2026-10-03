import { classes, type Props, type Sized } from "./attributes";

export function Range({ class: className, ...attributes }: Omit<Props<"input", Sized>, "type">) {
  return <input type="range" class={classes("v-range", className)} {...attributes} />;
}
