import type { Child, PropsWithChildren } from "hono/jsx";

/** `Stat` cards in a row that share its height, or in a column that share its width. */
export function StatList({
  orientation = "horizontal",
  children,
}: PropsWithChildren<{ orientation?: "horizontal" | "vertical" }>) {
  const stack = orientation === "horizontal" ? "stack-h" : "stack-v";
  return (
    <dl composite-component="StatList" class={`${stack} items-stretch gap-s t-tabular`}>
      {children}
    </dl>
  );
}

type StatProps = {
  label: string;
  value: string;
  /** What the value is measured against, shown smaller after it as "value / outOf". */
  outOf?: string;
  /** Shown at the end of the line under the value, such as a percentage. */
  share?: string;
  /** Shown at the start of the line under the value. */
  note?: string;
  /** Shown between the value and the note, such as a bar. */
  children?: Child;
};

/** One figure in a `StatList`. */
export function Stat({ label, value, outOf, share, note, children }: StatProps) {
  return (
    <div composite-component="Stat" class="stack-v gap-3xs flex-1 b-all bc-subtle br-l p-xs">
      <dt class="fs-s ink-subtle">{label}</dt>
      <dd class="stack-h flex-nowrap items-baseline gap-2xs">
        <span class="fs-l fw-medium">{value}</span>
        {outOf && <span class="fs-s ink-subtle">/ {outOf}</span>}
      </dd>
      {children && <dd class="mt-3xs">{children}</dd>}
      {(note || share) && (
        <dd class="stack-h flex-nowrap items-baseline gap-xs fs-xs ink-subtle">
          {note && <span>{note}</span>}
          {share && <span class="ml-auto">{share}</span>}
        </dd>
      )}
    </div>
  );
}
