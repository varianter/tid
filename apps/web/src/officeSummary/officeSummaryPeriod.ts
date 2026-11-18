/** A month, or a whole year by its number. */
export type Period = Temporal.PlainYearMonth | number;

export const isYear = (period: Period) => typeof period === "number";

const decemberOf = (year: number) => Temporal.PlainYearMonth.from({ year, month: 12 });

/** The months the period covers, stopping at `thisMonth` so a year in progress isn't measured against months to come. */
export function monthsOf(period: Period, thisMonth: Temporal.PlainYearMonth) {
  if (!isYear(period)) return [period];
  return Array.from({ length: 12 }, (_, index) =>
    Temporal.PlainYearMonth.from({ year: period, month: index + 1 }),
  ).filter((month) => Temporal.PlainYearMonth.compare(month, thisMonth) <= 0);
}

/** Every month of the year, months to come included. */
export const monthsOfYear = (year: number) => monthsOf(year, decemberOf(year));

export function shiftPeriod(period: Period, steps: number): Period {
  return isYear(period) ? period + steps : period.add({ months: steps });
}

/** The year a month is in, or a month of the year: the current one, or December of a past year. */
export function togglePeriod(period: Period, thisMonth: Temporal.PlainYearMonth): Period {
  if (!isYear(period)) return period.year;
  return thisMonth.year === period ? thisMonth : decemberOf(period);
}
