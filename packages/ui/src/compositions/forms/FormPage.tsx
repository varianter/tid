import { attributes } from "@tid/via/attributes";
import type { Child, PropsWithChildren } from "hono/jsx";
import { classes } from "../../primitives/attributes";
import { Button } from "../../primitives/Button";
import { ColorMode } from "../../primitives/ColorMode";
import type { PopoverType } from "../../primitives/Popover";
import { FormError } from "./FormError";

type FormPageProps = PropsWithChildren<{
  title: string;
  /** A line under the title about what the form changes. */
  description?: Child;
  /** The page the form was opened from. Cancelling goes back to it, or closes its layer. */
  cancel?: string;
  /** The submit button's label. Without one there's nothing to submit, and the page only shows its content. */
  submit?: string;
  /** The form's state from its last submission. */
  form: {
    /** What's wrong with the form as a whole, rather than with one field. */
    formError?: string;
    /** The last submission went through. */
    saved?: boolean;
  };
  /** How the form is shown when it's opened in a layer. Without one, `@tid/via` shows a dialog. */
  layer?: PopoverType;
  /**
   * Once it's submitted, the page it ends on replaces the whole page rather than showing in the
   * layer, for a form that ends on a page of its own. Errors still show in the layer.
   */
  leavesLayer?: boolean;
  /** The widest the page gets, as a step on Varde's width scale. */
  width?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}>;

/** A page that is one form, as opposed to a `Page` that shows something. */
export function FormPage({
  title,
  description,
  cancel,
  submit,
  form,
  layer,
  leavesLayer,
  width,
  children,
}: FormPageProps) {
  const leave = cancel && (
    <Button as="a" href={cancel} data-variant="plain" {...{ [attributes.dismiss]: true }}>
      {submit ? "Cancel" : "Back"}
    </Button>
  );
  return (
    // A layer takes only the box, so `main`'s padding is what a page has beyond a layer's.
    <main composite-component="FormPage">
      {/* Hono moves a title rendered in the body into the head. */}
      <title>{title}</title>
      {/* The page as a layer shows it: a layer takes this box whole, so its width comes along. */}
      <div
        class={classes("px-s-m py-m", width === undefined ? undefined : `w-max-${width}`)}
        style="min-width: min(55ch, 90svw);"
        {...{ [attributes.layerType]: layer }}
      >
        <header class="-mt-m -mx-s-m b-b bc-subtle gap-3xs mb-s px-s-m py-2xs stack-v surface-tinted">
          <h1 class="fs-m fw-medium">{title}</h1>
          {description && <p class="ink-subtle">{description}</p>}
        </header>
        {form.saved && (
          <ColorMode palette="green" role="status" class="mb-s">
            <div class="surface-dyed py-4xs px-xs b-all bc-subtle br-l">
              <p class="ink-subtle fs-s">Your changes have been saved.</p>
            </div>
          </ColorMode>
        )}
        {submit ? (
          <form method="post" {...{ [attributes.leaveLayer]: leavesLayer }} class="stack-v gap-l">
            {form.formError && <FormError id="form-error" errors={[form.formError]} />}
            {children}
            <div class="stack-h items-center gap-xs w-full">
              <Button type="submit">{submit}</Button>
              {leave}
            </div>
          </form>
        ) : (
          <div class="stack-v items-start gap-l">
            {children}
            {leave}
          </div>
        )}
      </div>
    </main>
  );
}
