import type { Context } from "hono";
import type { FC } from "hono/jsx";
import { z } from "zod";

// import type { UserEnv } from "../auth/session";

type Ctx = Context;

// The shape zod gives per field, so `onSubmit` can put errors on fields too.
export type FieldErrors<S extends z.ZodType> = {
  [K in keyof z.infer<S>]?: string[];
};

export type FormProps = {
  values?: Record<string, string>;
  fieldErrors?: Partial<Record<string, string[]>>;
  formError?: string;
};

/**
 * One form on one URL: GET renders it, POST validates and submits, then
 * redirects (303) or re-renders the form with errors (422).
 */
export function formAction<S extends z.ZodType, P extends object>(opts: {
  /** Validates the POST body. Failures re-render with field errors. */
  schema: S;
  /** Runs first on GET and POST. Returns the view's props, or a Response (404, 403) to stop. */
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
  /** Renders the form. Gets the loader's props, plus `values`, `fieldErrors` and `formError` after a failed POST. */
  view: FC<P & FormProps>;
}) {
  const View = opts.view;
  return async (c: Ctx) => {
    const props = await opts.loader(c);
    if (props instanceof Response) return props;
    if (c.req.method === "GET") return c.render(<View {...props} />);

    // `all` keeps repeated fields (checkboxes) as arrays for the schema.
    // `values` drops them, so a multi-select isn't re-checked on a 422.
    const body = await c.req.parseBody({ all: true });
    const values = Object.fromEntries(
      Object.entries(body).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
    const form = opts.schema.safeParse(body);
    if (!form.success) {
      c.status(422);
      // formErrors come from a refine without a path (cross-field rules).
      const { fieldErrors, formErrors } = z.flattenError(form.error);
      return c.render(
        <View {...props} values={values} fieldErrors={fieldErrors} formError={formErrors[0]} />,
      );
    }
    const result = await opts.onSubmit(c, form.data, props);
    if ("fieldErrors" in result) {
      c.status(422);
      return c.render(<View {...props} values={values} fieldErrors={result.fieldErrors} />);
    }
    if ("formError" in result) {
      c.status(422);
      return c.render(<View {...props} values={values} formError={result.formError} />);
    }
    return c.redirect(result.redirect, 303);
  };
}
