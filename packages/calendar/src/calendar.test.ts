import { expect, test } from "bun:test";
import { calendarFor } from "./calendar";

const norway = calendarFor("NO");
const sweden = calendarFor("SE");

test("weekends and the country's own days off aren't workdays, but eves that aren't off are", () => {
  expect(norway.isWorkday("2026-05-15")).toBe(true);
  expect(norway.isWorkday("2026-05-16")).toBe(false);
  expect(norway.isWorkday("2027-05-17")).toBe(false);
  expect(sweden.isWorkday("2027-05-17")).toBe(true);
  expect(sweden.isWorkday("2026-06-19")).toBe(false);
  expect(sweden.isWorkday("2026-01-05")).toBe(true);
  expect(sweden.isWorkday("2026-10-30")).toBe(true);
});

test("workdaysIn lists the month's workdays in order", () => {
  // May 2026 has 21 weekdays; 1 May, Ascension Day and Whit Monday fall on three of them.
  expect(norway.workdaysIn("2026-05")).toHaveLength(18);
  expect(norway.workdaysIn("2026-05").slice(0, 2)).toEqual(["2026-05-04", "2026-05-05"]);
});
