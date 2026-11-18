import { thisMonthInOslo } from "@tid/calendar/osloClock";

// The current month opens on today, wherever the link comes from.
export const monthPath = (month: Temporal.PlainYearMonth, showWeekends: boolean) =>
  `/timesheet/month/${month}${showWeekends ? "?weekends=on" : ""}${month.equals(thisMonthInOslo()) ? "#today" : ""}`;

// The query rides along, so a save can return to the same view.
export const cellsActionOf = (month: Temporal.PlainYearMonth, search: string) =>
  `/timesheet/month/${month}/cells${search}`;

export const billableAssignmentsActionOf = (month: Temporal.PlainYearMonth, search: string) =>
  `/timesheet/month/${month}/billable-assignments${search}`;
