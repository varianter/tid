import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../../primitives/Button";
import { ColorMode } from "../../primitives/ColorMode";
import { FormError } from "./FormError";
import { ReturnLink } from "./ReturnLink";

type FormProps = PropsWithChildren<{
  /** The form's state from its last submission. */
  state: {
    /** What's wrong with the form as a whole, rather than with one field. */
    formError?: string;
    /** The last submission went through. */
    saved?: boolean;
  };
  /** The submit button's label. */
  submit: string;
  /** The page the form was opened from. Cancelling goes back to it, or closes its layer. */
  cancel?: string;
}>;

/** One submission: its fields, what went wrong last time, and the buttons that submit or cancel it. */
export function Form({ state, submit, cancel, children }: FormProps) {
  return (
    <form method="post" composite-component="Form" class="stack-v gap-l">
      {state.saved && (
        <ColorMode palette="green" role="status">
          <div class="surface-dyed py-4xs px-xs b-all bc-subtle br-l">
            <p class="ink-subtle fs-s">Your changes have been saved.</p>
          </div>
        </ColorMode>
      )}
      {state.formError && <FormError id="form-error" errors={[state.formError]} />}
      {children}
      <div class="stack-h items-center gap-xs w-full">
        <Button type="submit">{submit}</Button>
        {cancel && <ReturnLink href={cancel}>Cancel</ReturnLink>}
      </div>
    </form>
  );
}
