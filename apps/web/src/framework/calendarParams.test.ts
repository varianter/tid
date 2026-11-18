import { expect, test } from "bun:test";
import { dayParam, monthParam } from "./calendarParams";

test("a day param takes YYYY-MM-DD only, and only days that exist", () => {
  expect(dayParam().safeParse("2026-09-28").data).toEqual(Temporal.PlainDate.from("2026-09-28"));
  for (const text of ["2026-02-30", "28-09-2026", "2026-13-01", "20260928", "2026-09-28T12:00"]) {
    expect(dayParam().safeParse(text).success).toBe(false);
  }
});

test("a month param takes YYYY-MM only, and only months that exist", () => {
  expect(monthParam.safeParse("2026-09").data).toEqual(Temporal.PlainYearMonth.from("2026-09"));
  for (const text of ["2026-13", "202609", "2026-09-01"]) {
    expect(monthParam.safeParse(text).success).toBe(false);
  }
});
