import { expect, test } from "bun:test";
import { hasMonthStarted, timeOfDayInOslo } from "./osloClock";

test("timeOfDayInOslo reads the clock in Oslo, summer time included", () => {
  expect(timeOfDayInOslo(new Date("2026-01-15T09:05:00Z"))).toEqual({ hour: 10, minute: 5 });
  expect(timeOfDayInOslo(new Date("2026-07-15T22:30:00Z"))).toEqual({ hour: 0, minute: 30 });
});

test("hasMonthStarted counts the current month in Oslo as started", () => {
  // 31 October 23:30 UTC is already 1 November in Oslo.
  const now = new Date("2026-10-31T23:30:00Z");
  expect(hasMonthStarted("2026-10", now)).toBe(true);
  expect(hasMonthStarted("2026-11", now)).toBe(true);
  expect(hasMonthStarted("2026-12", now)).toBe(false);
});
