import { expect, test } from "bun:test";
import { formatDate } from "./dateDisplay";

test("dates read the same everywhere, whatever the ICU version", () => {
  expect(formatDate("2026-09-03")).toBe("3 September 2026");
  expect(formatDate("2026-10-03", "numeric")).toBe("2026.10.03");
  expect(formatDate("2026-10-03", "dayAndMonth")).toBe("3 October");
  expect(formatDate("2026-10-03", "day")).toBe("Sat 3");
});

test("the month style takes a month or a day in it", () => {
  expect(formatDate("2026-10", "month")).toBe("October 2026");
  expect(formatDate("2026-10-31", "month")).toBe("October 2026");
  expect(formatDate("2026-10", "monthName")).toBe("October");
  expect(formatDate("2026-10-31", "monthName")).toBe("October");
});
