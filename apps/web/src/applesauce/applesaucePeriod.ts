import { addMonths, isIsoMonth } from "@tid/calendar/isoDate";

/** A month as `YYYY-MM`, or a whole year as `YYYY`. */
export type Period = string;

export const isPeriod = (value: string) => /^\d{4}$/.test(value) || isIsoMonth(value);

export const isYear = (period: Period) => period.length === 4;

/** The months the period covers, stopping at `thisMonth` so a year in progress isn't measured against months to come. */
export function monthsOf(period: Period, thisMonth: string) {
  if (!isYear(period)) return [period];
  return Array.from({ length: 12 }, (_, index) => addMonths(`${period}-01`, index)).filter(
    (month) => month <= thisMonth,
  );
}

export function shiftPeriod(period: Period, steps: number) {
  return isYear(period) ? String(Number(period) + steps) : addMonths(period, steps);
}

/** The year a month is in, or a month of the year: the current one, or December of a past year. */
export function togglePeriod(period: Period, thisMonth: string) {
  if (!isYear(period)) return period.slice(0, 4);
  return thisMonth.startsWith(period) ? thisMonth : `${period}-12`;
}
