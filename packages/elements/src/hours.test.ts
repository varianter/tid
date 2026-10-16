import { expect, test } from "bun:test";
import { formatHours, formatTotalHours } from "./hours";

test("formatHours writes Norwegian decimals and blanks zero", () => {
  expect(formatHours(450)).toBe("7,5");
  expect(formatHours(420)).toBe("7");
  expect(formatHours(0)).toBe("");
});

test("formatTotalHours reads zero as zero", () => {
  expect(formatTotalHours(450)).toBe("7,5 h");
  expect(formatTotalHours(0)).toBe("0 h");
});
