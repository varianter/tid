import { expect, test } from "bun:test";
import { formatHours, formatTotalHours, parseHours } from "./hours";

test("formatHours writes Norwegian decimals and blanks zero", () => {
  expect(formatHours(450)).toBe("7,5");
  expect(formatHours(420)).toBe("7");
  expect(formatHours(0)).toBe("");
});

test("formatTotalHours reads zero as zero", () => {
  expect(formatTotalHours(450)).toBe("7,5 h");
  expect(formatTotalHours(0)).toBe("0 h");
});

test("parseHours reads decimals, clock durations and blanks", () => {
  expect(parseHours("7,5")).toBe(450);
  expect(parseHours(" 7.5 ")).toBe(450);
  expect(parseHours("7:30")).toBe(450);
  expect(parseHours("8")).toBe(480);
  expect(parseHours("")).toBe(0);
  expect(parseHours("seven")).toBeUndefined();
  expect(parseHours("7:75")).toBeUndefined();
});
