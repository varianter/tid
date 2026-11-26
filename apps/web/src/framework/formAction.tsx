import type { Context } from "hono";
import type { FC } from "hono/jsx";
import { z } from "zod";
import { type Flash, setFlash } from "./flash";

type Ctx = Context;

// Distributes over a union schema, so every variant's fields can be named.
type FieldName<S extends z.ZodType> =
  z.input<S> extends infer Input ? (Input extends object ? keyof Input & string : never) : never;

// The shape zod gives per field, so `onSubmit` can put errors on fields too.
export type FieldErrors<S extends z.ZodType> = { [K in FieldName<S>]?: string[] };

/** What a form page shows of the last submission, so a failed one keeps what was typed. */
export type FormState<S extends z.ZodType> = {
  /** What was sent. Only set after a failed POST, so a GET shows the defaults. */
  values?: { [K in FieldName<S>]?: string };
  fieldErrors: FieldErrors<S>;
  /** What's wrong with the form as a whole, rather than with one field. */
  formError?: string;
};

/**
 * One form on one URL: GET renders it, POST validates and submits, then
 * redirects (303) or re-renders the form with errors (422). The view renders the whole page: a
 * `FormPage` holding a `Form` given the `form` state.
 */
export function formAction<S extends z.ZodType, P extends object>(opts: {
  /** Validates the POST body. Failures re-render with field errors. */
  schema: S;
  /** Runs first on GET and POST. Returns the view's props, or a Response, like a 404, to stop. A refusal throws an `HTTPException`. */
  loader: (c: Ctx) => Promise<P | Response>;
  /**
   * Runs on valid input with the loader's props. Returns one of:
   * - `redirect`: where to go next. Add a `flash` when that's the page the form was opened from,
   *   since a page the user already saw won't make the change obvious. Leave it out when the
   *   redirect goes to a new page, like the client just created, which shows the change itself.
   * - `fieldErrors`: what's wrong with each field, like a name that's taken.
   * - `formError`: what's wrong with the form as a whole.
   */
  onSubmit: (
    c: Ctx,
    data: z.infer<S>,
    props: P,
  ) => Promise<
    { redirect: string; flash?: Flash } | { fieldErrors: FieldErrors<S> } | { formError: string }
  >;
  /** Renders the form's page from the loader's props and the form's state. */
  view: FC<P & { form: FormState<S> }>;
}) {
  const View = opts.view;
  const render = (c: Ctx, props: P, failure: Partial<FormState<S>> = {}) =>
    c.render(<View {...props} form={{ fieldErrors: {}, ...failure }} />);
  return async (c: Ctx) => {
    const props = await opts.loader(c);
    if (props instanceof Response) return props;
    if (c.req.method === "GET") return render(c, props);

    // `all` keeps repeated fields (checkboxes) as arrays for the schema.
    // `values` drops them, so a multi-select isn't re-checked on a 422.
    const body = await c.req.parseBody({ all: true });
    // Unvalidated, so it may lack fields or hold others. It's only shown back, never trusted.
    const values: FormState<S>["values"] = Object.fromEntries(
      Object.entries(body).filter((e): e is [string, string] => typeof e[1] === "string"),
    ) as FormState<S>["values"];
    const form = opts.schema.safeParse(body);
    if (!form.success) {
      c.status(422);
      // formErrors come from a refine without a path (cross-field rules).
      const { fieldErrors, formErrors } = z.flattenError(form.error);
      return render(c, props, { values, fieldErrors, formError: formErrors[0] });
    }
    const result = await opts.onSubmit(c, form.data, props);
    if ("fieldErrors" in result) {
      c.status(422);
      return render(c, props, { values, fieldErrors: result.fieldErrors });
    }
    if ("formError" in result) {
      c.status(422);
      return render(c, props, { values, formError: result.formError });
    }
    if (result.flash) setFlash(c, result.flash);
    return c.redirect(result.redirect, 303);
  };
}
