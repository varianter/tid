import { expect, test } from "bun:test";
import { dayOf, mondayOfWeek, todayIso, Weekday } from "./week";

const wednesday = new Date("2026-10-14T12:00:00Z");

test("dayOf anchors weeks to the Monday of the current week", () => {
  expect(mondayOfWeek(wednesday)).toBe("2026-10-12");
  expect(dayOf(wednesday, 0, Weekday.Monday)).toBe("2026-10-12");
  expect(dayOf(wednesday, 0, Weekday.Wednesday)).toBe("2026-10-14");
  expect(dayOf(wednesday, -1, Weekday.Friday)).toBe("2026-10-09");
});

test("todayIso reads the UTC date, ignoring the time of day", () => {
  expect(todayIso(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-14");
});
