import { expect, test } from "bun:test";
import { formatDate, formatMonth } from "./dateDisplay";

test("dates read the same everywhere, whatever the ICU version", () => {
  expect(formatDate(Temporal.PlainDate.from("2026-09-03"))).toBe("3 September 2026");
  expect(formatDate(Temporal.PlainDate.from("2026-10-03"), "numeric")).toBe("2026.10.03");
  expect(formatDate(Temporal.PlainDate.from("2026-10-03"), "dayAndMonth")).toBe("3 October");
  expect(formatDate(Temporal.PlainDate.from("2026-10-03"), "day")).toBe("Sat 3");
});

test("months read the same everywhere, whatever the ICU version", () => {
  expect(formatMonth(Temporal.PlainYearMonth.from("2026-10"))).toBe("October 2026");
  expect(formatMonth(Temporal.PlainYearMonth.from("2026-10"), "monthName")).toBe("October");
});
