import { firstDayOf, lastDayOf } from "@tid/calendar/calendarMonth";
import { between, type Column } from "drizzle-orm";

/** Rows whose `day` falls in `month`. */
export const inMonth = (day: Column, month: Temporal.PlainYearMonth) =>
  between(day, firstDayOf(month), lastDayOf(month));
