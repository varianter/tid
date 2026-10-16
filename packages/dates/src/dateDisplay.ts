import { parseIsoDate } from "./isoDate";

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

/** Like "October 2026". */
export function formatMonth(month: string) {
  return monthFormat.format(parseIsoDate(`${month}-01`));
}
