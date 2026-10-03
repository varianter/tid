import { classes, type Props, type Sized } from "./attributes";

export function Radio({ class: className, ...attributes }: Omit<Props<"input", Sized>, "type">) {
  return <input type="radio" class={classes("v-radio", className)} {...attributes} />;
}
