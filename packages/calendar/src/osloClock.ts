// The business runs on Oslo time, wherever the server is.
const oslo = "Europe/Oslo";

function inOslo(moment: Date) {
  return moment.toTemporalInstant().toZonedDateTimeISO(oslo);
}

export function dayInOslo(moment: Date) {
  return inOslo(moment).toPlainDate();
}

export function timeOfDayInOslo(moment: Date) {
  const { hour, minute } = inOslo(moment);
  return { hour, minute };
}

export function todayInOslo() {
  return Temporal.Now.plainDateISO(oslo);
}

export function thisMonthInOslo() {
  return todayInOslo().toPlainYearMonth();
}

/** Whether the month has begun in Oslo, the current month included. */
export function hasMonthStarted(month: Temporal.PlainYearMonth) {
  return Temporal.PlainYearMonth.compare(month, thisMonthInOslo()) <= 0;
}
