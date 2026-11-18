export function isWeekend(day: Temporal.PlainDate) {
  return day.dayOfWeek >= 6;
}

export function mondayOf(day: Temporal.PlainDate) {
  return day.subtract({ days: day.dayOfWeek - 1 });
}
