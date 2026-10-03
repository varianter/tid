import type { Child } from "hono/jsx";
import { Label } from "../../primitives/Label";
import { FormError } from "./FormError";

type FieldProps = {
  label: string;
  name: string;
  id?: string;
  errors?: string[];
  children: Child;
};

/** Spread `fieldErrorAttributes` on the child control so it points at the error. */
export function Field({ label, name, id, errors, children }: FieldProps) {
  const inputId = id ?? name;

  return (
    <div class="stack-v gap-2xs">
      <Label for={inputId}>{label}</Label>
      {children}
      {errors && <FormError id={`${inputId}-error`} errors={errors} />}
    </div>
  );
}

export function fieldErrorAttributes(inputId: string, errors: string[] | undefined) {
  return errors?.length
    ? { "aria-invalid": "true" as const, "aria-describedby": `${inputId}-error` }
    : {};
}
