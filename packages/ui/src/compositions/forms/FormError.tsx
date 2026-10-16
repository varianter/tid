import { ColorMode } from "../../primitives/ColorMode";

type FormErrorProps = {
  errors: string[];
  id: string;
};

export function FormError({ errors, id }: FormErrorProps) {
  if (!errors.length) return null;

  return (
    <ColorMode id={id} palette="coral" class="d-block ink-default" role="alert">
      {errors.join(", ")}
    </ColorMode>
  );
}
