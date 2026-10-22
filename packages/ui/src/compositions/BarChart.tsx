import { classes, type Props } from "../primitives/attributes";

export type BarChartPoint = { label: string; value: number };

/**
 * A column chart: one bar per point, bottom-aligned on a baseline with its
 * label beneath it. `max` sets the top of the plot and defaults to the
 * largest value; a value beyond `max` stretches the scale rather than
 * spilling the plot. Bars are `surface-tinted`, so their hue comes from the
 * surrounding color-mode. With `track`, each bar fills a column of its own
 * like a vertical progress bar, and takes the color-mode's ink to stand out.
 */
export function BarChart({
  points,
  max,
  height = 132,
  track = false,
  class: className,
  ...attributes
}: Props<"div", { points: BarChartPoint[]; max?: number; height?: number; track?: boolean }>) {
  const scale = Math.max(max ?? 0, ...points.map((point) => point.value)) || 1;
  return (
    <div
      composite-component="BarChart"
      class={classes("d-grid gap-column-3xs", className)}
      style={`grid-template-columns: repeat(${points.length}, 1fr);`}
      {...attributes}
    >
      <div
        class={classes(
          "grid-all-columns grid-subgrid",
          track ? "items-stretch" : "items-end b-b bc-subtle",
        )}
        style={`height: ${height}px;`}
      >
        {points.map((point) => {
          const bar = (
            <div
              class={
                track ? "bg-currentcolor ink-default" : "surface-tinted br-s br-bl-none br-br-none"
              }
              style={`height: ${asPercent(point.value, scale)}%;`}
            />
          );
          return track ? (
            <div class="d-grid items-end surface-tinted br-s of-hidden">{bar}</div>
          ) : (
            bar
          );
        })}
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
