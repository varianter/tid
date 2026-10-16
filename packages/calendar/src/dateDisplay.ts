import { parseIsoDate } from "./isoDate";

const longFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Every date reads one way, in one of these styles. Pick one of them over adding another.
const styles = {
  /** Like "3 October 2026". */
  full: (isoDate: string) => longFormat.format(parseIsoDate(isoDate)),
  /** Like "2026.10.03", for table columns, where dates line up and sort by eye. */
  numeric: (isoDate: string) => isoDate.replaceAll("-", "."),
  /** Like "Sat 3", for where the month is already shown. */
  day: (isoDate: string) => dayFormat.format(parseIsoDate(isoDate)),
  /** Like "October 2026". Takes a month as well as a day. */
  month: (isoDate: string) => monthFormat.format(parseIsoDate(`${isoDate.slice(0, 7)}-01`)),
};

export type DateStyle = keyof typeof styles;

export function formatDate(isoDate: string, style: DateStyle = "full") {
  return styles[style](isoDate);
}
