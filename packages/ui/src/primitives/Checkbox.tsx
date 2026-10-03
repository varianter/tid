import { classes, type Props, type Sized } from "./attributes";

export function Checkbox({ class: className, ...attributes }: Omit<Props<"input", Sized>, "type">) {
  return <input type="checkbox" class={classes("v-checkbox", className)} {...attributes} />;
}
