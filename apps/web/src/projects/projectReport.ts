import { type Calendar, calendarFor } from "@tid/calendar";
import { daysOf } from "@tid/calendar/calendarMonth";
import { formatMonth } from "@tid/calendar/dateDisplay";
import type { Country } from "@tid/calendar/publicHolidays";
import type { Billing } from "./billing";

/** `hoursByDay` is keyed by day of the month. */
type Consultant = { name: string; hoursByDay: Map<number, number>; hours: number };

export type ProjectReport = {
  project: {
    id: number;
    code: string;
    name: string;
    billing: Billing;
    clientId: number;
    client: string;
    currency: string | null;
  };
  /** The month, as people read it. */
  period: string;
  days: Temporal.PlainDate[];
  calendar: Calendar;
  consultants: Consultant[];
  hours: number;
  /** In the project's currency. Only hourly projects have an amount to show. */
  amount: number | undefined;
};

/** A consultant's hours and amount on one day. */
export type DayEntry = {
  email: string;
  name: string;
  day: Temporal.PlainDate;
  hours: number;
  amount: number;
};

/** The report of a project's day entries in `month`, a row per consultant. */
export function buildProjectReport(
  project: ProjectReport["project"],
  entries: DayEntry[],
  month: Temporal.PlainYearMonth,
  country: Country,
): ProjectReport {
  const consultants = new Map<string, Consultant>();
  for (const entry of entries) {
    const consultant = consultants.get(entry.email) ?? {
      name: entry.name,
      hoursByDay: new Map(),
      hours: 0,
    };
    consultant.hoursByDay.set(entry.day.day, entry.hours);
    consultant.hours += entry.hours;
    consultants.set(entry.email, consultant);
  }

  return {
    project,
    period: formatMonth(month),
    days: daysOf(month),
    calendar: calendarFor(country),
    consultants: [...consultants.values()],
    hours: entries.reduce((total, entry) => total + entry.hours, 0),
    amount:
      project.billing === "hourly" && project.currency
        ? entries.reduce((total, entry) => total + entry.amount, 0)
        : undefined,
  };
}
