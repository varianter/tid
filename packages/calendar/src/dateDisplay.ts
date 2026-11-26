import { firstDayOf } from "./calendarMonth";

const longFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });
const dayAndMonthFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const monthNameFormat = new Intl.DateTimeFormat("en-GB", { month: "long" });

// Every date reads one way, in one of these styles. Pick one of them over adding another.
const dayStyles = {
  /** Like "3 October 2026". */
  full: (day: Temporal.PlainDate) => longFormat.format(day),
  /** Like "2026.10.03", for table columns, where dates line up and sort by eye. */
  numeric: (day: Temporal.PlainDate) => day.toString().replaceAll("-", "."),
  /** Like "3 October", for dates near enough that the year goes without saying. */
  dayAndMonth: (day: Temporal.PlainDate) => dayAndMonthFormat.format(day),
  /** Like "Sat 3", for where the month is already shown. */
  day: (day: Temporal.PlainDate) => dayFormat.format(day),
};

// Intl rejects a PlainYearMonth, whose ISO calendar differs from the formatter's Gregorian one, so a
// month is shown by its first day.
const monthStyles = {
  /** Like "October 2026". */
  month: (month: Temporal.PlainYearMonth) => monthFormat.format(firstDayOf(month)),
  /** Like "October", for where the year is already shown. */
  monthName: (month: Temporal.PlainYearMonth) => monthNameFormat.format(firstDayOf(month)),
};

export function formatDate(day: Temporal.PlainDate, style: keyof typeof dayStyles = "full") {
  return dayStyles[style](day);
}

export function formatMonth(
  month: Temporal.PlainYearMonth,
  style: keyof typeof monthStyles = "month",
) {
  return monthStyles[style](month);
}
