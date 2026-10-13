// Dates are ISO strings: days as YYYY-MM-DD, months as YYYY-MM.
// They're handled at midnight UTC, so no time zone can shift a day.

const dayInMilliseconds = 86_400_000;

// Every date reads one way, from these four formats. Pick one of them over adding a fifth.
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const dayInMonthFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isoDateInOslo(moment: Date) {
  // Swedish formats dates as YYYY-MM-DD.
  return moment.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIsoDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

export function todayInOslo() {
  return isoDateInOslo(new Date());
}

export function addDays(isoDate: string, days: number) {
  return toIsoDate(new Date(parseIsoDate(isoDate).getTime() + days * dayInMilliseconds));
}

export function mondayOf(isoDate: string) {
  const daysSinceMonday = (parseIsoDate(isoDate).getUTCDay() + 6) % 7;
  return addDays(isoDate, -daysSinceMonday);
}

export function isWeekend(isoDate: string) {
  const weekday = parseIsoDate(isoDate).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** Like "3 October 2026". */
export function formatDate(isoDate: string) {
  return dateFormat.format(parseIsoDate(isoDate));
}

/** Like "2026.10.03", for table columns, where dates line up and sort by eye. */
export function formatTableDate(isoDate: string) {
  return isoDate.replaceAll("-", ".");
}

/** Like "Sat 3", for where the month is already shown. */
export function formatDayInMonth(isoDate: string) {
  return dayInMonthFormat.format(parseIsoDate(isoDate));
}

export function isIsoMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) && isIsoDate(`${value}-01`);
}

export function addMonths(month: string, months: number) {
  const date = parseIsoDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIsoDate(date).slice(0, 7);
}

export function daysOfMonth(month: string) {
  const firstDay = `${month}-01`;
  const dayCount = Number(addDays(`${addMonths(month, 1)}-01`, -1).slice(8));
  return Array.from({ length: dayCount }, (_, index) => addDays(firstDay, index));
}

/** Like "October 2026". */
export function formatMonth(month: string) {
  return monthFormat.format(parseIsoDate(`${month}-01`));
}
