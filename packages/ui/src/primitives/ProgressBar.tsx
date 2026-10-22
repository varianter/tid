import { classes, type Props } from "./attributes";

type Segment = { value: number; color: string };

/**
 * A bar filled by segments in order. It is 1em tall, so a font-size class sizes it.
 * Segments beyond `max` stretch the scale rather than spill out of the bar.
 */
export function ProgressBar({
  segments,
  max,
  class: className,
  ...attributes
}: Props<"div", { segments: Segment[]; max: number }>) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const scale = Math.max(total, max) || 1;
  return (
    <div
      class={classes(
        "stack-h nowrap gap-none of-hidden b-all bc-subtle surface-tinted br-m",
        className,
      )}
      style="height: 1em;"
      aria-hidden="true"
      {...attributes}
    >
      {segments.map((segment) => (
        <span
          style={`height: 100%; width: ${(segment.value / scale) * 100}%; background: ${segment.color};`}
        />
      ))}
    </div>
  );
}
