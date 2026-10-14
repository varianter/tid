// The business runs on Oslo time, wherever the server is.

export function isoDateInOslo(moment: Date) {
  // Swedish formats dates as YYYY-MM-DD.
  return moment.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

export function todayInOslo() {
  return isoDateInOslo(new Date());
}
