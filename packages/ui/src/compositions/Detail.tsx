import type { PropsWithChildren } from "hono/jsx";

/** A label and value in a `<dl>`. */
export function Detail({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div composite-component="Detail" class="stack-v gap-3xs">
      <dt class="fs-s ink-subtle">{label}</dt>
      <dd class="fw-medium">{children}</dd>
    </div>
  );
}
