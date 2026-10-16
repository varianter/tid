import { calendarFor } from "@tid/calendar";
import type { Country } from "@tid/calendar/publicHolidays";

/** Minutes a consultant is expected to work in the month, up to and including `until`. */
// ponytail: every workday counts as a full day; subtract leave once we store it.
export function capacityMinutes(
  month: string,
  country: Country,
  fullDayMinutes: number,
  until?: string | null,
) {
  const workdays = calendarFor(country)
    .workdaysIn(month)
    .filter((day) => !until || day <= until);
  return workdays.length * fullDayMinutes;
}
