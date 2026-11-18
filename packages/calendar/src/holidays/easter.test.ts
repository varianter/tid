import { expect, test } from "bun:test";
import { easterSunday } from "./easter";

test("easterSunday matches published dates, earliest and latest possible included", () => {
  expect(easterSunday(2024)).toEqual(Temporal.PlainDate.from("2024-03-31"));
  expect(easterSunday(2026)).toEqual(Temporal.PlainDate.from("2026-04-05"));
  expect(easterSunday(2038)).toEqual(Temporal.PlainDate.from("2038-04-25"));
  expect(easterSunday(2285)).toEqual(Temporal.PlainDate.from("2285-03-22"));
});
