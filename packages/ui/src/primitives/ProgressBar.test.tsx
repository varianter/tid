import { describe, expect, test } from "bun:test";
import { ProgressBar } from "./ProgressBar";

const hasTick = (bar: unknown) => String(bar).includes("pos-absolute");

describe("ProgressBar", () => {
  test("marks max with a tick once the segments go past it", () => {
    expect(hasTick(<ProgressBar max={10} segments={[{ value: 12, palette: "blue" }]} />)).toBe(
      true,
    );
  });

  test("has no tick up to max", () => {
    expect(hasTick(<ProgressBar max={10} segments={[{ value: 10, palette: "blue" }]} />)).toBe(
      false,
    );
  });

  test("has no tick when parts of max add up to a hair above it", () => {
    // 23 minutes in hours, split at 7: the parts sum to more than the whole in floating point.
    const hours = 23 / 60;
    const billable = 7 / 60;
    expect(billable + (hours - billable)).toBeGreaterThan(hours);
    expect(
      hasTick(
        <ProgressBar
          max={hours}
          segments={[
            { value: billable, palette: "blue" },
            { value: hours - billable, palette: "blue", shade: "soft" },
          ]}
        />,
      ),
    ).toBe(false);
  });
});
