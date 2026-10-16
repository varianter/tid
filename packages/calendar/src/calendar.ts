import { type Country, getPublicHolidays } from "./holidays/publicHolidays";
import { daysOfMonth, isWeekend } from "./isoDate";

export type Calendar = ReturnType<typeof calendarFor>;

/** The working calendar of a country: weekends and its public holidays are days off. */
export function calendarFor(country: Country) {
  const isWorkday = (isoDate: string) =>
    !isWeekend(isoDate) &&
    !getPublicHolidays(Number(isoDate.slice(0, 4)), country).some(
      (holiday) => holiday.date === isoDate,
    );

  return {
    isWorkday,
    workdaysIn: (month: string) => daysOfMonth(month).filter(isWorkday),
  };
}
