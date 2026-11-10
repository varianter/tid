import { attributes } from "@tid/via/attributes";
import type { PropsWithChildren } from "hono/jsx";
import type { PopoverType } from "../primitives/Popover";

type PageFrameProps = PropsWithChildren<{
  /** Which page composition this frames, for `composite-component`. */
  component: string;
  title: string;
  /** How the page is shown when it's opened in a layer. Without one, `@tid/via` shows a dialog. */
  layer?: PopoverType;
  /** The page is a form, so a submission that ends on it is a next step and stays in a layer. */
  form?: boolean;
  /** On the box a layer takes, so a layer shows the page with the same spacing and width. */
  class?: string;
  style?: string;
}>;

/** What every page is to the browser and to `@tid/via`: a `main`, its title, and the box a layer takes. */
export function PageFrame({
  component,
  title,
  layer,
  form,
  class: className,
  style,
  children,
}: PageFrameProps) {
  return (
    // A layer takes only the box, so `main`'s padding is what a page has beyond a layer's.
    <main composite-component={component} {...{ [attributes.formPage]: form }}>
      {/* Hono moves a title rendered in the body into the head. */}
      <title>{title}</title>
      <div class={className} style={style} {...{ [attributes.layerType]: layer }}>
        {children}
      </div>
    </main>
  );
}
