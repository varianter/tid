import { calendarFor } from "@tid/calendar";
import type { Country } from "@tid/calendar/publicHolidays";
import type { Employment } from "../users/employment";

/** Minutes a consultant is expected to work in the month, counting only days in `employment`. */
// ponytail: every workday counts as a full day; subtract leave once we store it.
export function capacityMinutes(
  month: string,
  country: Country,
  fullDayMinutes: number,
  { firstDay, lastDay }: Employment = {},
) {
  const workdays = calendarFor(country)
    .workdaysIn(month)
    .filter((day) => (!firstDay || day >= firstDay) && (!lastDay || day <= lastDay));
  return workdays.length * fullDayMinutes;
}
