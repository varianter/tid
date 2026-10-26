import { type Calendar, calendarFor } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import { daysOfMonth } from "@tid/calendar/isoDate";
import { formatAmount } from "../amount/amount";
import type { Company } from "../organizations/companyFilter";
import type { Billing } from "./billing";

type Consultant = { name: string; hoursByDay: Map<string, number>; hours: number };

export type ProjectReport = {
  project: {
    id: number;
    code: string;
    name: string;
    billing: Billing;
    clientId: number;
    client: string;
  };
  /** The month, as people read it. */
  period: string;
  days: string[];
  calendar: Calendar;
  consultants: Consultant[];
  hours: number;
  /** Only hourly projects have an amount to show. */
  amount: string | undefined;
};

/** A consultant's hours and amount on one day. */
export type DayEntry = { email: string; name: string; day: string; hours: number; amount: number };

/** The report of a project's day entries in `month`, a row per consultant. */
export function buildProjectReport(
  project: ProjectReport["project"] & { currency: string | null },
  entries: DayEntry[],
  month: string,
  company: Company,
): ProjectReport {
  const consultants = new Map<string, Consultant>();
  for (const entry of entries) {
    const consultant = consultants.get(entry.email) ?? {
      name: entry.name,
      hoursByDay: new Map(),
      hours: 0,
    };
    consultant.hoursByDay.set(entry.day, entry.hours);
    consultant.hours += entry.hours;
    consultants.set(entry.email, consultant);
  }

  return {
    project,
    period: formatDate(month, "month"),
    days: daysOfMonth(month),
    calendar: calendarFor(company.country),
    consultants: [...consultants.values()],
    hours: entries.reduce((total, entry) => total + entry.hours, 0),
    amount:
      project.billing === "hourly" && project.currency
        ? formatAmount(
            entries.reduce((total, entry) => total + entry.amount, 0),
            project.currency,
            2,
          )
        : undefined,
  };
}
