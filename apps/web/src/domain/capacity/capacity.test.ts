import { expect, test } from "bun:test";
import { capacityMinutes } from "./capacity";

test("capacity leaves out weekends and the organization's holidays", () => {
  // May 2026 has 21 weekdays; 1 May, Ascension Day and Whit Monday fall on three of them.
  expect(capacityMinutes("2026-05", "NO", 60)).toBe(18 * 60);
  // Sweden has no Whit Monday off.
  expect(capacityMinutes("2026-05", "SE", 60)).toBe(19 * 60);
  expect(capacityMinutes("2026-05", "NO", 60, { lastDay: "2026-05-08" })).toBe(5 * 60);
});

test("capacity counts only from the first day", () => {
  // 18–29 May leaves nine workdays once Whit Monday is out.
  expect(capacityMinutes("2026-05", "NO", 60, { firstDay: "2026-05-18" })).toBe(9 * 60);
  expect(capacityMinutes("2026-05", "NO", 60, { firstDay: "2026-06-01" })).toBe(0);
});
