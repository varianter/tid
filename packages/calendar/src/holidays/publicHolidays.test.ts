import { expect, test } from "bun:test";
import type { Country } from "./publicHolidays";
import { getPublicHolidays } from "./publicHolidays";

function datesById(country: Country, year: number) {
  return new Map(getPublicHolidays(year, country).map((holiday) => [holiday.id, holiday.date]));
}

test("swedish midsummer and all saints are Saturdays, with midsummer eve the Friday before", () => {
  const dates = datesById("SE", 2024);

  expect(dates.get("midsummer-eve")).toBe("2024-06-21");
  expect(dates.get("midsummer-day")).toBe("2024-06-22");
  expect(dates.get("all-saints-day")).toBe("2024-11-02");
});

test("swedish christmas and new year's eves fall on the 24th and 31st", () => {
  const dates = datesById("SE", 2024);

  expect(dates.get("christmas-eve")).toBe("2024-12-24");
  expect(dates.get("new-years-eve")).toBe("2024-12-31");
});

test("norwegian maundy thursday and eves keep their shared ids", () => {
  const dates = datesById("NO", 2024);

  expect(dates.get("maundy-thursday")).toBe("2024-03-28");
  expect(dates.get("christmas-eve")).toBe("2024-12-24");
  expect(dates.get("new-years-eve")).toBe("2024-12-31");
});
