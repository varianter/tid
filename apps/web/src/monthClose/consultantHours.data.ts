import { firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import type { Country } from "@tid/calendar/publicHolidays";
import { projects, tasks, timeEntries, users } from "@tid/db/schema";
import { and, between, eq, gte, isNull, or, sql } from "drizzle-orm";
import { capacityMinutes } from "../domain/capacity/capacity";
import { database } from "../framework/database";

export type ConsultantHours = {
  id: number;
  name: string;
  minutes: number;
  billableMinutes: number;
  expectedMinutes: number;
  missingMinutes: number;
};

/**
 * What each of the organization's consultants logged in `month` against what was expected of them,
 * by name. Consultants who left before the month are left out.
 */
export async function loadConsultantHours(
  organization: { id: number; country: Country; fullDayMinutes: number },
  month: string,
): Promise<ConsultantHours[]> {
  const first = firstDayOfMonth(month);
  const today = todayInOslo();

  const consultants = await database
    .select({
      id: users.id,
      name: users.name,
      lastDay: users.lastDay,
      minutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
      billableMinutes:
        sql`coalesce(sum(${timeEntries.minutes}) filter (where ${projects.billing} <> 'non_billable'), 0)`.mapWith(
          Number,
        ),
    })
    .from(users)
    .leftJoin(
      timeEntries,
      and(
        eq(timeEntries.userId, users.id),
        between(timeEntries.spentOn, first, lastDayOfMonth(month)),
      ),
    )
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(eq(users.orgId, organization.id), or(isNull(users.lastDay), gte(users.lastDay, first))),
    )
    .groupBy(users.id)
    .orderBy(users.name);

  return consultants.map((consultant) => {
    // Hours not yet due don't count as missing, so the current month only checks up to today.
    const until = consultant.lastDay && consultant.lastDay < today ? consultant.lastDay : today;
    const expectedMinutes = capacityMinutes(
      month,
      organization.country,
      organization.fullDayMinutes,
      until,
    );
    return {
      id: consultant.id,
      name: consultant.name,
      minutes: consultant.minutes,
      billableMinutes: consultant.billableMinutes,
      expectedMinutes,
      missingMinutes: Math.max(expectedMinutes - consultant.minutes, 0),
    };
  });
}
