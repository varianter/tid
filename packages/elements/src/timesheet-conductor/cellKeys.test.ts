import { expect, test } from "bun:test";
import { remainingMinutes, stepHalfHour } from "./cellKeys";

test("stepHalfHour moves by half an hour", () => {
  expect(stepHalfHour(450, 1)).toBe(480);
  expect(stepHalfHour(450, -1)).toBe(420);
});

test("stepHalfHour snaps odd values to the half-hour grid", () => {
  expect(stepHalfHour(435, 1)).toBe(450);
  expect(stepHalfHour(435, -1)).toBe(420);
});

test("stepHalfHour stays within a day", () => {
  expect(stepHalfHour(0, -1)).toBe(0);
  expect(stepHalfHour(24 * 60, 1)).toBe(24 * 60);
});

test("remainingMinutes fills what's left of the day", () => {
  expect(remainingMinutes(450, [180])).toBe(270);
  expect(remainingMinutes(450, [60])).toBe(390);
  expect(remainingMinutes(450, [])).toBe(450);
});

test("remainingMinutes is zero once the day is full", () => {
  expect(remainingMinutes(450, [300, 300])).toBe(0);
});
