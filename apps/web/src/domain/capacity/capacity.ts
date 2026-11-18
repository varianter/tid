import { calendarFor } from "@tid/calendar";
import type { Country } from "@tid/calendar/publicHolidays";

/** Minutes a consultant is expected to work in the month, up to and including `until`. */
// ponytail: every workday counts as a full day; subtract leave once we store it.
export function capacityMinutes(
  month: Temporal.PlainYearMonth,
  country: Country,
  fullDayMinutes: number,
  until?: Temporal.PlainDate | null,
) {
  const workdays = calendarFor(country)
    .workdaysIn(month)
    .filter((day) => !until || Temporal.PlainDate.compare(day, until) <= 0);
  return workdays.length * fullDayMinutes;
}
