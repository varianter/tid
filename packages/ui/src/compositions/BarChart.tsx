import { classes, type Props } from "../primitives/attributes";

export type BarChartPoint = { label: string; value: number };

/**
 * A column chart: one bar per point, bottom-aligned on a baseline with its
 * label beneath it. `max` sets the top of the plot and defaults to the
 * largest value; a value beyond `max` stretches the scale rather than
 * spilling the plot. Bars are `surface-tinted`, so their hue comes from the
 * surrounding color-mode.
 */
export function BarChart({
  points,
  max,
  height = 132,
  class: className,
  ...attributes
}: Props<"div", { points: BarChartPoint[]; max?: number; height?: number }>) {
  const scale = Math.max(max ?? 0, ...points.map((point) => point.value)) || 1;
  return (
    <div
      class={classes("d-grid gap-column-3xs", className)}
      style={`grid-template-columns: repeat(${points.length}, 1fr);`}
      {...attributes}
    >
      <div
        class="grid-all-columns grid-subgrid items-end b-b bc-subtle"
        style={`height: ${height}px;`}
      >
        {points.map((point) => (
          <div
            class="surface-tinted br-s br-bl-none br-br-none"
            style={`height: ${asPercent(point.value, scale)}%;`}
          />
        ))}
      </div>
      <div class="grid-all-columns grid-subgrid mt-3xs" style="font-size: 8px;">
        {points.map((point) => (
          <time class="ta-center ink-subtle t-tabular" datetime={point.label}>
            {point.label}
          </time>
        ))}
      </div>
    </div>
  );
}

function asPercent(value: number, scale: number) {
  return Number(((value / scale) * 100).toFixed(2));
}
