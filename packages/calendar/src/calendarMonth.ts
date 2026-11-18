export function firstDayOf(month: Temporal.PlainYearMonth) {
  return month.toPlainDate({ day: 1 });
}

export function lastDayOf(month: Temporal.PlainYearMonth) {
  return month.toPlainDate({ day: month.daysInMonth });
}

export function daysOf(month: Temporal.PlainYearMonth) {
  return Array.from({ length: month.daysInMonth }, (_, index) =>
    month.toPlainDate({ day: index + 1 }),
  );
}
