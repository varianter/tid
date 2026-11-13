import { expect, test } from "bun:test";
import { remainingMinutes } from "./dayFill";

test("remainingMinutes fills what's left of the day", () => {
  expect(remainingMinutes(450, [180])).toBe(270);
  expect(remainingMinutes(450, [60])).toBe(390);
  expect(remainingMinutes(450, [])).toBe(450);
});

test("remainingMinutes is zero once the day is full", () => {
  expect(remainingMinutes(450, [300, 300])).toBe(0);
});
