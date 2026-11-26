import { expect, test } from "bun:test";
import { stepHalfHour } from "./cellKeys";

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
