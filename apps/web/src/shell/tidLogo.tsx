/*
 * Tid's symbol is a T in a circle. While hovered, its crossbar slides down the stem and
 * the two become a clock's hands.
 *
 * The motion is a spring simulation, run once when this module loads. Each value's path
 * is baked into a CSS `linear()` easing, so the browser plays it without JavaScript.
 * A spring that starts from rest has the same shape however far it travels, which is
 * what lets the hands' angles stay in CSS.
 *
 * The view box is 100 wide, so percentages equal user units.
 */

type Pose = {
  pivotY: number;
  barAngle: number;
  barRightLength: number;
  barLeftLength: number;
  barWidth: number;
  stemAngle: number;
  stemLength: number;
  stemWidth: number;
  filletScale: number;
};

/** A function is a target that moves, followed on every step. */
type SpringTarget = number | ((pose: Pose) => number);

type SpringEvent = {
  at: number;
  to: Partial<Record<keyof Pose, SpringTarget>>;
  stiffness: number;
  damping: number;
};

type Spring = { velocity: number; target: SpringTarget; stiffness: number; damping: number };

// The T's proportions, in view box units. Everything else follows from these.
const thickness = 13;
const barLength = 54;
/** From the top of the crossbar to the foot of the stem. */
const teeHeight = 56;
const handThickness = 12;

const filletRadius = thickness / 4;
// A T carries its weight in the crossbar, so centred exactly it looks high.
const opticalDrop = 4;

const tee: Pose = {
  pivotY: 50 - teeHeight / 2 + opticalDrop + thickness / 2,
  barAngle: 0,
  barRightLength: barLength / 2,
  barLeftLength: barLength / 2,
  barWidth: thickness,
  stemAngle: 90,
  stemLength: teeHeight - thickness / 2,
  stemWidth: thickness,
  filletScale: 1,
};

// The hands' angles here only shape the springs; the rendered time comes from CSS.
const clock: Pose = {
  pivotY: 50,
  barAngle: -30,
  barRightLength: 33.33,
  barLeftLength: 0,
  barWidth: handThickness,
  stemAngle: 215,
  stemLength: 20.83,
  stemWidth: handThickness,
  filletScale: 0,
};

// The stem's foot stays put while the bar slides along it.
const stemFoot = tee.pivotY + tee.stemLength;
const followStemFoot = (pose: Pose) => stemFoot - pose.pivotY;

const intoClock: SpringEvent[] = [
  { at: 0, to: { stemLength: followStemFoot }, stiffness: 3000, damping: 110 },
  { at: 0, to: { pivotY: tee.pivotY - 2.5 }, stiffness: 500, damping: 36 },
  { at: 0.09, to: { pivotY: clock.pivotY }, stiffness: 210, damping: 17 },
  { at: 0.24, to: { filletScale: 0 }, stiffness: 400, damping: 40 },
  { at: 0.27, to: { barAngle: clock.barAngle }, stiffness: 150, damping: 14 },
  {
    at: 0.27,
    to: { barRightLength: clock.barRightLength, barWidth: clock.barWidth },
    stiffness: 160,
    damping: 24,
  },
  { at: 0.27, to: { barLeftLength: clock.barLeftLength }, stiffness: 280, damping: 34 },
  { at: 0.28, to: { stemLength: clock.stemLength }, stiffness: 150, damping: 22 },
  { at: 0.34, to: { stemAngle: clock.stemAngle }, stiffness: 90, damping: 15 },
  { at: 0.34, to: { stemWidth: clock.stemWidth }, stiffness: 160, damping: 26 },
];

// Back to the T, the hands line up before the bar climbs, so it is never crooked.
const intoTee: SpringEvent[] = [
  { at: 0, to: { barAngle: tee.barAngle }, stiffness: 150, damping: 16 },
  { at: 0, to: { stemAngle: tee.stemAngle }, stiffness: 120, damping: 18 },
  {
    at: 0,
    to: {
      barRightLength: tee.barRightLength,
      barLeftLength: tee.barLeftLength,
      barWidth: tee.barWidth,
      stemWidth: tee.stemWidth,
    },
    stiffness: 160,
    damping: 24,
  },
  { at: 0.08, to: { stemLength: stemFoot - clock.pivotY }, stiffness: 150, damping: 22 },
  { at: 0.3, to: { pivotY: tee.pivotY }, stiffness: 200, damping: 20 },
  { at: 0.3, to: { stemLength: followStemFoot }, stiffness: 3000, damping: 110 },
  { at: 0.45, to: { filletScale: tee.filletScale }, stiffness: 300, damping: 34 },
];

const durationSeconds = 1.6;
const stepsPerSecond = 240;
const easingPoints = 48;

function simulateSprings(start: Pose, events: SpringEvent[]): Pose[] {
  const pose = { ...start };
  const keys = Object.keys(pose) as (keyof Pose)[];
  const springs = Object.fromEntries(
    keys.map((key): [keyof Pose, Spring] => [
      key,
      { velocity: 0, target: pose[key], stiffness: 0, damping: 0 },
    ]),
  ) as Record<keyof Pose, Spring>;
  const poses: Pose[] = [];
  const stepSeconds = 1 / stepsPerSecond;
  for (let step = 0; step <= durationSeconds * stepsPerSecond; step++) {
    const seconds = step * stepSeconds;
    for (const event of events) {
      if (event.at > seconds || event.at <= seconds - stepSeconds) continue;
      for (const [key, target] of Object.entries(event.to) as [keyof Pose, SpringTarget][]) {
        // Velocity carries over, so a retargeted spring keeps its momentum.
        Object.assign(springs[key], { target, stiffness: event.stiffness, damping: event.damping });
      }
    }
    for (const key of keys) {
      const spring = springs[key];
      const target = typeof spring.target === "function" ? spring.target(pose) : spring.target;
      const acceleration =
        -spring.stiffness * (pose[key] - target) - spring.damping * spring.velocity;
      spring.velocity += acceleration * stepSeconds;
      pose[key] += spring.velocity * stepSeconds;
    }
    poses.push({ ...pose });
  }
  return poses;
}

/** A value's path from `from` to `to`, as a CSS easing. */
function bakeEasing(poses: Pose[], key: keyof Pose, from: Pose, to: Pose) {
  const points = Array.from({ length: easingPoints }, (_, index) => {
    const pose = poses[Math.round((index / (easingPoints - 1)) * (poses.length - 1))] as Pose;
    return ((pose[key] - from[key]) / (to[key] - from[key])).toFixed(3);
  });
  // Ends exactly on the target, even where a spring hasn't quite settled.
  points[points.length - 1] = "1";
  return `linear(${points.join(", ")})`;
}

type AnimatedPart = {
  selector: string;
  property: "translate" | "rotate" | "scale";
  key: keyof Pose;
  tee: string;
  clock: string;
};

const parts: AnimatedPart[] = [
  {
    selector: ".pivot",
    property: "translate",
    key: "pivotY",
    tee: "0 0",
    clock: `0 ${clock.pivotY - tee.pivotY}%`,
  },
  {
    selector: ".bar",
    property: "rotate",
    key: "barAngle",
    tee: "0deg",
    clock: "var(--minute-angle)",
  },
  {
    selector: ".bar-width",
    property: "scale",
    key: "barWidth",
    tee: `1 ${tee.barWidth}`,
    clock: `1 ${clock.barWidth}`,
  },
  {
    selector: ".bar-right",
    property: "scale",
    key: "barRightLength",
    tee: `${tee.barRightLength} 1`,
    clock: `${clock.barRightLength} 1`,
  },
  {
    selector: ".bar-left",
    property: "scale",
    key: "barLeftLength",
    tee: `${tee.barLeftLength} 1`,
    clock: `${clock.barLeftLength} 1`,
  },
  {
    selector: ".stem",
    property: "rotate",
    key: "stemAngle",
    tee: "90deg",
    clock: "var(--hour-angle)",
  },
  {
    selector: ".stem-length",
    property: "scale",
    key: "stemLength",
    tee: `${tee.stemLength} 1`,
    clock: `${clock.stemLength} 1`,
  },
  {
    selector: ".stem-width",
    property: "scale",
    key: "stemWidth",
    tee: `1 ${tee.stemWidth}`,
    clock: `1 ${clock.stemWidth}`,
  },
  { selector: ".fillet", property: "scale", key: "filletScale", tee: "1", clock: "0" },
];

function partRules(pose: "tee" | "clock") {
  const poses =
    pose === "clock" ? simulateSprings(tee, intoClock) : simulateSprings(clock, intoTee);
  const [from, to] = pose === "clock" ? [tee, clock] : [clock, tee];
  return parts
    .map(
      (part) =>
        `${part.selector} { ${part.property}: ${part[pose]}; transition: ${part.property} ${durationSeconds}s ${bakeEasing(poses, part.key, from, to)}; }`,
    )
    .join("\n");
}

const scopedStyle = `@scope {
  :scope {
    --minute-angle: calc(var(--minute) * 6deg - 90deg);
    --hour-angle: calc(var(--hour) * 30deg + var(--minute) * 0.5deg - 90deg);
  }
  g { transform-box: view-box; transform-origin: 0 0; }
  .fillet-right { transform-origin: ${tee.barWidth / 2}% ${tee.stemWidth / 2}%; }
  .fillet-left { transform-origin: ${tee.barWidth / 2}% ${-tee.stemWidth / 2}%; }
  ${partRules("tee")}
  @media (prefers-reduced-motion: no-preference) {
    :scope:hover {
      ${partRules("clock")}
    }
  }
}`;

function filletPath(side: 1 | -1) {
  const crossbarEdge = tee.barWidth / 2;
  const stemEdge = (side * tee.stemWidth) / 2;
  const sweep = side === 1 ? 1 : 0;
  return `M${crossbarEdge} ${stemEdge}L${crossbarEdge} ${stemEdge + side * filletRadius}A${filletRadius} ${filletRadius} 0 0 ${sweep} ${crossbarEdge + filletRadius} ${stemEdge}Z`;
}

/** Decorative; pair it with the name in text. The clock shows `time`. */
export function TidSymbol({
  time,
  class: className,
}: {
  time: { hour: number; minute: number };
  class?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width="24"
      height="24"
      fill="currentColor"
      class={className}
      // A 12-hour hour keeps the hour hand's turn under half a lap.
      style={`--hour: ${time.hour % 12}; --minute: ${time.minute}`}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: scopedStyle }} />
      <mask id="tid-symbol-mark">
        <rect width="100" height="100" fill="white" />
        <g fill="black" class="pivot" transform={`translate(50 ${tee.pivotY})`}>
          <g class="stem">
            <g class="stem-length">
              <g class="stem-width">
                <rect y="-0.5" width="1" height="1" />
              </g>
            </g>
            <g class="fillet fillet-right">
              <path d={filletPath(1)} />
            </g>
            <g class="fillet fillet-left">
              <path d={filletPath(-1)} />
            </g>
          </g>
          <g class="bar">
            <g class="bar-width">
              <g class="bar-right">
                <rect y="-0.5" width="1" height="1" />
              </g>
              <g class="bar-left">
                <rect x="-1" y="-0.5" width="1" height="1" />
              </g>
            </g>
          </g>
          <circle r={handThickness / 2} />
        </g>
      </mask>
      <circle cx="50" cy="50" r="50" mask="url(#tid-symbol-mark)" />
    </svg>
  );
}

const crossbarTop = tee.pivotY - tee.barWidth / 2;
const crossbarBottom = tee.pivotY + tee.barWidth / 2;
const stemLeft = 50 - tee.stemWidth / 2;
const stemRight = 50 + tee.stemWidth / 2;
const teePath = `M${50 - tee.barLeftLength} ${crossbarTop}H${50 + tee.barRightLength}V${crossbarBottom}H${stemRight + filletRadius}A${filletRadius} ${filletRadius} 0 0 0 ${stemRight} ${crossbarBottom + filletRadius}V${stemFoot}H${stemLeft}V${crossbarBottom + filletRadius}A${filletRadius} ${filletRadius} 0 0 0 ${stemLeft - filletRadius} ${crossbarBottom}H${50 - tee.barLeftLength}Z`;

// Tabs don't animate icons, so the favicon is the resting T.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>circle{fill:#282828}path{fill:#fff}@media (prefers-color-scheme:dark){circle{fill:#fff}path{fill:#282828}}</style><circle cx="50" cy="50" r="50"/><path d="${teePath}"/></svg>`;

export const tidFaviconHref = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;
