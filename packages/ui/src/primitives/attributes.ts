import type { JSX } from "hono/jsx";

type Tag = keyof JSX.IntrinsicElements;

// Hono accepts any attribute on every element. Dropping that index signature
// makes typos and attributes from the wrong element (`href` on a button) errors.
export type AttributesOf<T extends Tag> = {
  [K in keyof JSX.IntrinsicElements[T] as string extends K
    ? never
    : K]: JSX.IntrinsicElements[T][K];
};

// `class` is narrowed to string because Hono also allows a Promise there.
export type Props<T extends Tag, Data = object> = Omit<AttributesOf<T>, "class" | keyof Data> &
  Data & { class?: string };

type Size = "small" | "medium" | "large";
export type Sized = { "data-size"?: Size };

export function classes(base: string, extra: string | undefined) {
  return extra ? `${base} ${extra}` : base;
}
