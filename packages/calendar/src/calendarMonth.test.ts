import { expect, test } from "bun:test";
import { daysOf, lastDayOf } from "./calendarMonth";

test("daysOf covers every day of the month, leap days included", () => {
  expect(daysOf(Temporal.PlainYearMonth.from("2026-09"))).toHaveLength(30);
  expect(daysOf(Temporal.PlainYearMonth.from("2028-02")).at(-1)).toEqual(
    Temporal.PlainDate.from("2028-02-29"),
  );
  expect(daysOf(Temporal.PlainYearMonth.from("2026-12")).at(-1)).toEqual(
    Temporal.PlainDate.from("2026-12-31"),
  );
});

test("lastDayOf knows month lengths, leap years included", () => {
  expect(lastDayOf(Temporal.PlainYearMonth.from("2026-09"))).toEqual(
    Temporal.PlainDate.from("2026-09-30"),
  );
  expect(lastDayOf(Temporal.PlainYearMonth.from("2028-02"))).toEqual(
    Temporal.PlainDate.from("2028-02-29"),
  );
});
