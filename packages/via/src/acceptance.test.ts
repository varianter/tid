import { expect, test } from "bun:test";
import { isAccepted } from "./acceptance";

const at = (path: string) => new URL(path, "https://tid.test");
const rates = at("/projects/1/consultants/rates");

test("a layer is done when it arrives back where the layer below is", () => {
  expect(isAccepted(at("/projects/1/consultants/rates"), rates)).toBe(true);
});

test("a query added on the way back doesn't stop a layer from being done", () => {
  expect(
    isAccepted(at("/timesheet/month/2026-10?weekends=on"), at("/timesheet/month/2026-10")),
  ).toBe(true);
});

test("a layer that arrives somewhere else carries on, like the next step of a form", () => {
  expect(isAccepted(at("/projects/1/consultants/4/rates/reprice?rate=1"), rates)).toBe(false);
});
