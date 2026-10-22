import type { Child, PropsWithChildren } from "hono/jsx";

/** A row of `Stat` cards that share its height. */
export function StatList({ children }: PropsWithChildren) {
  return (
    <dl composite-component="StatList" class="stack-h items-stretch gap-s t-tabular">
      {children}
    </dl>
  );
}

type StatProps = {
  label: string;
  value: string;
  /** Shown beside the value, such as a percentage. */
  share?: string;
  /** A line under the value, such as what it's measured against. */
  note?: string;
  /** Shown between the value and the note, such as a bar. */
  children?: Child;
};

/** One figure in a `StatList`. */
export function Stat({ label, value, share, note, children }: StatProps) {
  return (
    <div composite-component="Stat" class="stack-v gap-3xs flex-1 b-all bc-subtle br-l p-s">
      <dt class="fs-s ink-subtle">{label}</dt>
      <dd class="stack-h nowrap items-baseline gap-xs">
        <span class="fs-l fw-medium">{value}</span>
        {share && <span class="ink-subtle">{share}</span>}
      </dd>
      {children && <dd class="mt-3xs">{children}</dd>}
      {note && <dd class="fs-xs ink-subtle">{note}</dd>}
    </div>
  );
}
