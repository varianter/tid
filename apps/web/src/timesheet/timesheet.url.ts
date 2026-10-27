import { thisMonthInOslo } from "@tid/calendar/osloClock";

// The current month opens on today, wherever the link comes from.
export const monthPath = (month: string, showWeekends: boolean) =>
  `/timesheet/month/${month}${showWeekends ? "?weekends=on" : ""}${month === thisMonthInOslo() ? "#today" : ""}`;

// The query rides along, so a save can return to the same view.
export const cellsActionOf = (month: string, search: string) =>
  `/timesheet/month/${month}/cells${search}`;
