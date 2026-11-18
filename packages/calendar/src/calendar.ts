import { isWeekend } from "./calendarDay";
import { daysOf } from "./calendarMonth";
import { type Country, getPublicHolidays } from "./holidays/publicHolidays";

export type Calendar = ReturnType<typeof calendarFor>;

/** The working calendar of a country: weekends and its public holidays are days off. */
export function calendarFor(country: Country) {
  const holidayOn = (day: Temporal.PlainDate) =>
    getPublicHolidays(day.year, country).find((holiday) => holiday.date.equals(day));
  const isWorkday = (day: Temporal.PlainDate) => !isWeekend(day) && !holidayOn(day);

  return {
    holidayOn,
    isWorkday,
    workdaysIn: (month: Temporal.PlainYearMonth) => daysOf(month).filter(isWorkday),
  };
}
