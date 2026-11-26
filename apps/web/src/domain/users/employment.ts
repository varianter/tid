import { firstDayOf, lastDayOf } from "@tid/calendar/calendarMonth";
import { users } from "@tid/db/schema";
import { and, gte, isNull, lte, or } from "drizzle-orm";

/** The days someone works at Variant, both included. Either end may be open. */
export type Employment = {
  firstDay?: Temporal.PlainDate | null;
  lastDay?: Temporal.PlainDate | null;
};

/** Users who work at Variant on at least one day of `month`. */
export const employedDuring = (month: Temporal.PlainYearMonth) =>
  and(
    or(isNull(users.firstDay), lte(users.firstDay, lastDayOf(month))),
    or(isNull(users.lastDay), gte(users.lastDay, firstDayOf(month))),
  );
