import { classes, type Props } from "./attributes";
import type { Palette } from "./ColorMode";

type Shade = "strong" | "soft";
type Segment = { value: number; palette: Exclude<Palette, "inherit">; shade?: Shade };

// The palette steps a shade names. Every palette has both.
const shadeSteps: Record<Shade, number> = { strong: 500, soft: 250 };

/**
 * A bar filled by segments in order. It is 1em tall, so a font-size class sizes it.
 * Segments beyond `max` stretch the scale rather than spill out of the bar,
 * and a tick reaching past the bar's edges marks where `max` is.
 * Without a `label` the bar is decorative, so text next to it has to state the value.
 */
export function ProgressBar({
  segments,
  max,
  label,
  class: className,
  ...attributes
}: Props<"div", { segments: Segment[]; max: number; label?: string }>) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const scale = Math.max(total, max) || 1;
  return (
    <div
      class={classes("pos-relative", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
      {...attributes}
    >
      <div class="stack-h flex-nowrap gap-none of-hidden surface-dyed br-m" style="height: 1em;">
        {segments.map((segment) => (
          <span
            class="h-full"
            style={`width: ${(segment.value / scale) * 100}%; background: ${segmentColor(segment)};`}
          />
        ))}
      </div>
      {exceeds(total, max) && (
        <span
          class="pos-absolute top-0 bottom-0 ink-prominent br-pill"
          // The ring in the page's surface keeps the tick apart from the segments it crosses.
          style={`left: calc(${(max / scale) * 100}% - 1px); width: 2px; background: currentColor; box-shadow: 0 0 0 1px var(--surface-base); margin-block: -0.125em`}
        />
      )}
    </div>
  );
}

/**
 * A dot in a segment's color, so a list can use the same colors as the bars elsewhere.
 * It's decorative, so the text next to it has to say what the color means.
 */
export function ProgressBarSwatch({
  palette,
  shade,
  class: className,
  ...attributes
}: Props<"span", Omit<Segment, "value">>) {
  return (
    <span
      class={classes("d-inline-block aspect-square br-circle", className)}
      aria-hidden="true"
      style={`width: 0.5em; background: ${segmentColor({ palette, shade })};`}
      {...attributes}
    />
  );
}

const segmentColor = ({ palette, shade = "strong" }: Omit<Segment, "value">) =>
  `var(--palette-${palette}-${shadeSteps[shade]})`;

/**
 * Callers often split `max` into parts, such as billable and the rest of the hours,
 * and floats can add those back up to a hair above `max`. That isn't going over.
 */
function exceeds(total: number, max: number) {
  return total - max > Math.abs(max) * 1e-9;
}
