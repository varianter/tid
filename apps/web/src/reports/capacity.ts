import { daysOfMonth, isWeekend } from "../dates/dates";

/** Minutes a consultant is expected to work in the month, up to and including `until`. */
// ponytail: every weekday counts as a full day; subtract holidays and leave once we store them.
export function capacityMinutes(month: string, fullDayMinutes: number, until?: string | null) {
  const workdays = daysOfMonth(month).filter((day) => !isWeekend(day) && (!until || day <= until));
  return workdays.length * fullDayMinutes;
}
