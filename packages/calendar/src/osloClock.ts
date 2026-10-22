import { monthOf } from "./isoDate";

// The business runs on Oslo time, wherever the server is.

export function isoDateInOslo(moment: Date) {
  // Swedish formats dates as YYYY-MM-DD.
  return moment.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

export function timeOfDayInOslo(moment: Date) {
  const [hour, minute] = moment
    .toLocaleTimeString("sv-SE", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" })
    .split(":")
    .map(Number) as [number, number];
  return { hour, minute };
}

export function todayInOslo() {
  return isoDateInOslo(new Date());
}

export function thisMonthInOslo() {
  return monthOf(todayInOslo());
}

/** Whether the month (YYYY-MM) has begun in Oslo, the current month included. */
export function hasMonthStarted(month: string, now = new Date()) {
  return month <= monthOf(isoDateInOslo(now));
}
