import { expect, test } from "bun:test";
import { cellHours } from "./timesheet.validation";

const minutesOf = (text: string) => cellHours.parse(text);
const errorOf = (text: string) => cellHours.safeParse(text).error?.issues[0]?.message;

test("cellHours reads Norwegian and English decimals as minutes", () => {
  expect(minutesOf("7,5")).toBe(450);
  expect(minutesOf("7.5")).toBe(450);
  expect(minutesOf(" 8 ")).toBe(480);
  expect(minutesOf("24")).toBe(1440);
});

test("cellHours treats blank and zero as a cleared cell", () => {
  expect(minutesOf("")).toBe(0);
  expect(minutesOf("0")).toBe(0);
});

test("cellHours takes only half hours up to a day", () => {
  expect(errorOf("1,25")).toBe("Use half hours, like 1,5");
  expect(errorOf("0,2")).toBe("Use half hours, like 1,5");
  expect(errorOf("24,5")).toBe("At most 24 hours");
  expect(errorOf("-1")).toBe("Enter hours, like 7,5");
  expect(errorOf("7:30")).toBe("Enter hours, like 7,5");
});
