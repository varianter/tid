import type { PropsWithChildren } from "hono/jsx";
import { type AttributesOf, classes, type Props, type Sized } from "./attributes";

type ButtonData = Sized & { "data-variant"?: "filled" | "tinted" | "outlined" | "plain" };

// Without `as`, TypeScript can't tell the branches apart and would accept a
// link's attributes on a button. `never` closes that gap for link-only ones.
type LinkOnly = { [K in Exclude<keyof AttributesOf<"a">, keyof AttributesOf<"button">>]?: never };

export type ButtonProps =
  | PropsWithChildren<Props<"button", ButtonData> & LinkOnly & { as?: "button" }>
  | PropsWithChildren<Props<"a", ButtonData> & { as: "a" }>;

export function Button(props: ButtonProps) {
  if (props.as === "a") {
    const { as, class: className, ...attributes } = props;
    return <a class={classes("v-button", className)} {...attributes} />;
  }
  const { as, class: className, ...attributes } = props;
  return <button class={classes("v-button", className)} {...attributes} />;
}
