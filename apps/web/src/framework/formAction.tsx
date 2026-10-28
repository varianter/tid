import type { Context } from "hono";
import type { FC } from "hono/jsx";
import { z } from "zod";

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
  /** The last submission went through, and redirected back here with `?saved`. */
  saved?: boolean;
};

/**
 * One form on one URL: GET renders it, POST validates and submits, then
 * redirects (303) or re-renders the form with errors (422). The view renders the whole page, as a
 * `FormPage` given the `form` state.
 */
export function formAction<S extends z.ZodType, P extends object>(opts: {
  /** Validates the POST body. Failures re-render with field errors. */
  schema: S;
  /** Runs first on GET and POST. Returns the view's props, or a Response, like a 404, to stop. A refusal throws an `HTTPException`. */
  loader: (c: Ctx) => Promise<P | Response>;
  /**
   * Runs on valid input with the loader's props. Returns where to redirect,
   * `fieldErrors` (a taken name), or a `formError` for the whole form.
   */
  onSubmit: (
    c: Ctx,
    data: z.infer<S>,
    props: P,
  ) => Promise<{ redirect: string } | { fieldErrors: FieldErrors<S> } | { formError: string }>;
  /** Renders the form's page from the loader's props and the form's state. */
  view: FC<P & { form: FormState<S> }>;
}) {
  const View = opts.view;
  const render = (c: Ctx, props: P, failure: Partial<FormState<S>> = {}) =>
    c.render(<View {...props} form={{ fieldErrors: {}, ...failure }} />);
  return async (c: Ctx) => {
    const props = await opts.loader(c);
    if (props instanceof Response) return props;
    if (c.req.method === "GET")
      return render(c, props, { saved: c.req.query("saved") !== undefined });

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
    return c.redirect(result.redirect, 303);
  };
}
