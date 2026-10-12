import { expect, test } from "bun:test";
import { formatHours } from "./hours";

test("formatHours writes Norwegian decimals and blanks zero", () => {
  expect(formatHours(450)).toBe("7,5");
  expect(formatHours(420)).toBe("7");
  expect(formatHours(0)).toBe("");
});
