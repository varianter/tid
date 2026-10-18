import { addDays, mondayOf } from "@tid/calendar/isoDate";
import { isoDateInOslo } from "@tid/calendar/osloClock";

// Weekday numbers follow ISO 8601, the convention the fixture's weekdays use:
// 1 is Monday and 7 is Sunday.
export const Weekday = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
} as const;

export type Weekday = (typeof Weekday)[keyof typeof Weekday];

export const workWeek: Weekday[] = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
];

export const weekdays: Weekday[] = [...workWeek, Weekday.Saturday, Weekday.Sunday];

// Weeks are relative to the one `now` falls in: 0 is this week, -1 is last week.
export function dayOf(now: Date, week: number, weekday: Weekday) {
  return addDays(mondayOf(isoDateInOslo(now)), week * 7 + weekday - 1);
}
