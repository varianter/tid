// Dates are ISO strings: days as YYYY-MM-DD, months as YYYY-MM.
// They're handled at midnight UTC, so no time zone can shift a day.

const dayInMilliseconds = 86_400_000;

export function parseIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIsoDate(value);
  return !Number.isNaN(date.getTime()) && formatIsoDate(date) === value;
}

export function addDays(isoDate: string, days: number) {
  return formatIsoDate(new Date(parseIsoDate(isoDate).getTime() + days * dayInMilliseconds));
}

export function mondayOf(isoDate: string) {
  const daysSinceMonday = (parseIsoDate(isoDate).getUTCDay() + 6) % 7;
  return addDays(isoDate, -daysSinceMonday);
}

export function isWeekend(isoDate: string) {
  const weekday = parseIsoDate(isoDate).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function isIsoMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) && isIsoDate(firstDayOfMonth(value));
}

export function addMonths(month: string, months: number) {
  const date = parseIsoDate(firstDayOfMonth(month));
  date.setUTCMonth(date.getUTCMonth() + months);
  return monthOf(formatIsoDate(date));
}

export function monthOf(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function firstDayOfMonth(month: string) {
  return `${month}-01`;
}

export function lastDayOfMonth(month: string) {
  return addDays(firstDayOfMonth(addMonths(month, 1)), -1);
}

export function daysOfMonth(month: string) {
  const dayCount = Number(lastDayOfMonth(month).slice(8));
  return Array.from({ length: dayCount }, (_, index) => addDays(firstDayOfMonth(month), index));
}
