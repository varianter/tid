import { expect, test } from "bun:test";
import { addMonths, daysOfMonth, isIsoDate, isWeekend, mondayOf } from "./isoDate";

test("mondayOf snaps any day, Sunday included, to the Monday before it", () => {
  expect(mondayOf("2026-09-28")).toBe("2026-09-28");
  expect(mondayOf("2026-09-30")).toBe("2026-09-28");
  expect(mondayOf("2026-10-04")).toBe("2026-09-28");
  expect(mondayOf("2027-01-01")).toBe("2026-12-28");
});

test("isIsoDate rejects malformed and impossible dates", () => {
  expect(isIsoDate("2026-09-28")).toBe(true);
  expect(isIsoDate("2026-02-30")).toBe(false);
  expect(isIsoDate("28-09-2026")).toBe(false);
  expect(isIsoDate("2026-13-01")).toBe(false);
});

test("daysOfMonth covers every day of the month, leap days included", () => {
  expect(daysOfMonth("2026-09")).toHaveLength(30);
  expect(daysOfMonth("2028-02").at(-1)).toBe("2028-02-29");
  expect(daysOfMonth("2026-12").at(-1)).toBe("2026-12-31");
});

test("addMonths crosses years", () => {
  expect(addMonths("2026-12", 1)).toBe("2027-01");
  expect(addMonths("2026-01", -1)).toBe("2025-12");
});

test("isWeekend is true for Saturday and Sunday only", () => {
  expect(["2026-10-02", "2026-10-03", "2026-10-04"].map(isWeekend)).toEqual([false, true, true]);
});
