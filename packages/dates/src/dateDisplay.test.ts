import { expect, test } from "bun:test";
import { formatDate, formatDayInMonth } from "./dateDisplay";

test("dates read the same everywhere, whatever the ICU version", () => {
  expect(formatDate("2026-09-03")).toBe("3 September 2026");
  expect(formatDayInMonth("2026-10-03")).toBe("Sat 3");
});
