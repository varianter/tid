import { expect, test } from "bun:test";
import { dayInOslo, hasMonthStarted, thisMonthInOslo, timeOfDayInOslo } from "./osloClock";

test("timeOfDayInOslo reads the clock in Oslo, summer time included", () => {
  expect(timeOfDayInOslo(new Date("2026-01-15T09:05:00Z"))).toEqual({ hour: 10, minute: 5 });
  expect(timeOfDayInOslo(new Date("2026-07-15T22:30:00Z"))).toEqual({ hour: 0, minute: 30 });
});

test("dayInOslo turns over at midnight in Oslo, not in UTC", () => {
  expect(dayInOslo(new Date("2026-10-31T22:59:00Z"))).toEqual(
    Temporal.PlainDate.from("2026-10-31"),
  );
  expect(dayInOslo(new Date("2026-10-31T23:00:00Z"))).toEqual(
    Temporal.PlainDate.from("2026-11-01"),
  );
});

test("hasMonthStarted counts the current month in Oslo as started", () => {
  const thisMonth = thisMonthInOslo();
  expect(hasMonthStarted(thisMonth.subtract({ months: 1 }))).toBe(true);
  expect(hasMonthStarted(thisMonth)).toBe(true);
  expect(hasMonthStarted(thisMonth.add({ months: 1 }))).toBe(false);
});
