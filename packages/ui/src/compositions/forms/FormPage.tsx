import type { Child, PropsWithChildren } from "hono/jsx";
import { Button } from "../../primitives/Button";
import type { PopoverType } from "../../primitives/Popover";
import { FormError } from "./FormError";

type FormPageProps = PropsWithChildren<{
  title: string;
  /** A line under the title about what the form changes. */
  description?: Child;
  /** The page the form was opened from. Cancelling goes back to it. */
  cancel?: string;
  /** The submit button's label. Without one there's nothing to submit, and the page only shows its content. */
  submit?: string;
  /** What's wrong with the form as a whole, rather than with one field. */
  formError?: string;
  /** How the form is shown when it's opened in a layer. */
  layer?: PopoverType;
}>;

/** A page that is one form, as opposed to a `Page` that shows something. */
export function FormPage({
  title,
  description,
  cancel,
  submit,
  formError,
  layer,
  children,
}: FormPageProps) {
  const leave = cancel && (
    <Button as="a" href={cancel} data-variant="plain">
      {submit ? "Cancel" : "Back"}
    </Button>
  );
  return (
    <main composite-component="FormPage" class="py-xl px-s" via-layer-type={layer}>
      {/* Hono moves a title rendered in the body into the head. */}
      <title>{title}</title>
      <header class="stack-v gap-3xs b-b bc-subtle pb-s mb-s">
        <h1 class="fs-xl fw-bold">{title}</h1>
        {description && <p class="ink-subtle">{description}</p>}
      </header>
      {submit ? (
        <form method="post" class="stack-v items-start gap-l">
          {formError && <FormError id="form-error" errors={[formError]} />}
          {children}
          <div class="stack-h items-center gap-xs">
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
    </main>
  );
}
