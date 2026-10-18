import { expect, test } from "bun:test";
import { dayOf, Weekday } from "./week";

const wednesday = new Date("2026-10-14T12:00:00Z");

test("dayOf anchors weeks to the Monday of the current week", () => {
  expect(dayOf(wednesday, 0, Weekday.Monday)).toBe("2026-10-12");
  expect(dayOf(wednesday, 0, Weekday.Wednesday)).toBe("2026-10-14");
  expect(dayOf(wednesday, -1, Weekday.Friday)).toBe("2026-10-09");
});

test("dayOf starts the week on Oslo's Monday, while UTC is still on Sunday", () => {
  const earlyMondayInOslo = new Date("2026-10-18T23:30:00Z");
  expect(dayOf(earlyMondayInOslo, 0, Weekday.Monday)).toBe("2026-10-19");
});
