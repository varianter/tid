const dayInMilliseconds = 86_400_000;

// Dates are ISO strings (YYYY-MM-DD) handled at midnight UTC, so no time zone can shift a day.
function parseIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIsoDate(value);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

export function addDays(isoDate: string, days: number) {
  return toIsoDate(new Date(parseIsoDate(isoDate).getTime() + days * dayInMilliseconds));
}

export function mondayOf(isoDate: string) {
  const daysSinceMonday = (parseIsoDate(isoDate).getUTCDay() + 6) % 7;
  return addDays(isoDate, -daysSinceMonday);
}

export function daysOfWeek(monday: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function todayInOslo() {
  // Swedish formats dates as YYYY-MM-DD.
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

const hoursFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });

/** Hours in Norwegian notation (450 → "7,5"). Zero is blank, like an empty cell. */
export function formatHours(minutes: number) {
  return minutes === 0 ? "" : hoursFormat.format(minutes / 60);
}

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const rangeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const formatWeekday = (isoDate: string) => weekdayFormat.format(parseIsoDate(isoDate));
export const formatDayMonth = (isoDate: string) => dayMonthFormat.format(parseIsoDate(isoDate));
export const formatDateRange = (start: string, end: string) =>
  rangeFormat.formatRange(parseIsoDate(start), parseIsoDate(end));

export function isIsoMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) && isIsoDate(`${value}-01`);
}

export function addMonths(month: string, months: number) {
  const date = parseIsoDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIsoDate(date).slice(0, 7);
}

export function daysOfMonth(month: string) {
  return Array.from({ length: 31 }, (_, index) => addDays(`${month}-01`, index)).filter((day) =>
    day.startsWith(month),
  );
}

export function isWeekend(isoDate: string) {
  const weekday = parseIsoDate(isoDate).getUTCDay();
  return weekday === 0 || weekday === 6;
}

const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const formatMonth = (month: string) => monthFormat.format(parseIsoDate(`${month}-01`));
