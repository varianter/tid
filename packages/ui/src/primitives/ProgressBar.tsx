import { classes, type Props } from "./attributes";
import type { Palette } from "./ColorMode";

type Shade = "strong" | "soft";
type Segment = { value: number; palette: Exclude<Palette, "inherit">; shade?: Shade };

// The palette steps a shade names. Every palette has both.
const shadeSteps: Record<Shade, number> = { strong: 500, soft: 250 };

/**
 * A bar filled by segments in order. It is 1em tall, so a font-size class sizes it.
 * Segments beyond `max` stretch the scale rather than spill out of the bar.
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
      class={classes(
        "stack-h nowrap gap-none of-hidden b-all bc-subtle surface-tinted br-m",
        className,
      )}
      style="height: 1em;"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
      {...attributes}
    >
      {segments.map((segment) => (
        <span
          style={`height: 100%; width: ${(segment.value / scale) * 100}%; background: var(--palette-${segment.palette}-${shadeSteps[segment.shade ?? "strong"]});`}
        />
      ))}
    </div>
  );
}
