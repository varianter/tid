import { expect, test } from "bun:test";
import { isWeekend, mondayOf } from "./calendarDay";

test("mondayOf snaps any day, Sunday included, to the Monday before it", () => {
  const monday = Temporal.PlainDate.from("2026-09-28");
  for (const text of ["2026-09-28", "2026-09-30", "2026-10-04"]) {
    expect(mondayOf(Temporal.PlainDate.from(text))).toEqual(monday);
  }
  expect(mondayOf(Temporal.PlainDate.from("2027-01-01"))).toEqual(
    Temporal.PlainDate.from("2026-12-28"),
  );
});

test("isWeekend is true for Saturday and Sunday only", () => {
  expect(
    ["2026-10-02", "2026-10-03", "2026-10-04"].map((text) =>
      isWeekend(Temporal.PlainDate.from(text)),
    ),
  ).toEqual([false, true, true]);
});
