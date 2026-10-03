import { classes, type Props, type Sized } from "./attributes";

export function Input({ class: className, ...attributes }: Props<"input", Sized>) {
  return <input class={classes("v-input", className)} {...attributes} />;
}
