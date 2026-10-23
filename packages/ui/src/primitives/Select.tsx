import type { PropsWithChildren } from "hono/jsx";
import { classes, type Props, type Sized } from "./attributes";

export type SelectOption<Value extends string | number> = {
  value: Value;
  label: string;
  /** Options with the same group sit under one `optgroup`. Ungrouped options come first. */
  group?: string;
};

type SelectProps<Value extends string | number> = Sized & {
  options?: SelectOption<Value>[];
  /** Usually a form value, which arrives as a string even when the option values are numbers. */
  selected?: string | number;
};

/**
 * Renders `options`, grouped by `group`. Anything passed as children comes first, such as a
 * disabled placeholder. Compares values as strings, since the DOM only knows strings.
 */
export function Select<Value extends string | number>({
  options = [],
  selected,
  class: className,
  children,
  ...attributes
}: PropsWithChildren<Props<"select", SelectProps<Value>>>) {
  // `v-select` is a customizable select, so label an `<optgroup>` with a `<legend>` child, not its
  // `label` attribute — the legend is easier to target and style, with the same semantics.
  const renderOption = (option: SelectOption<Value>) => (
    <option value={String(option.value)} selected={String(option.value) === String(selected)}>
      {option.label}
    </option>
  );
  const groups = Map.groupBy(options, (option) => option.group);
  return (
    <select class={classes("v-select", className)} {...attributes}>
      {children}
      {[...groups].map(([group, items]) =>
        group === undefined ? (
          items.map(renderOption)
        ) : (
          <optgroup>
            <legend>{group}</legend>
            {items.map(renderOption)}
          </optgroup>
        ),
      )}
    </select>
  );
}
