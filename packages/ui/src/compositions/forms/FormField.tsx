import { Input } from "../../primitives/Input";
import { Field, fieldErrorAttributes } from "./Field";

type FormFieldProps = Parameters<typeof Input>[0] & {
  name: string;
  label: string;
  errors?: string[];
};

export function FormField({ label, name, id, errors, ...rest }: FormFieldProps) {
  const inputId = id ?? name;

  return (
    <Field label={label} name={name} id={inputId} errors={errors}>
      <Input id={inputId} name={name} {...fieldErrorAttributes(inputId, errors)} {...rest} />
    </Field>
  );
}
