import { expect, test } from "bun:test";
import { capacityMinutes } from "./capacity";

test("capacity leaves out weekends and the organization's holidays", () => {
  // May 2026 has 21 weekdays; 1 May, Ascension Day and Whit Monday fall on three of them.
  expect(capacityMinutes("2026-05", "NO", 60)).toBe(18 * 60);
  // Sweden has no Whit Monday off.
  expect(capacityMinutes("2026-05", "SE", 60)).toBe(19 * 60);
  expect(capacityMinutes("2026-05", "NO", 60, "2026-05-08")).toBe(5 * 60);
});
