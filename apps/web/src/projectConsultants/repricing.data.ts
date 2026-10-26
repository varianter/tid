import { assignmentRates, tasks, timeEntries, users } from "@tid/db/schema";
import { and, asc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { database } from "../database";
import type { NewRate, ProjectConsultantIds } from "./projectConsultant";

// A rate prices the entries from its start until the next rate takes over. Entries outside that
// period keep their price, so history imported from Harvest isn't flattened to today's rates.
async function periodOf(ids: ProjectConsultantIds, validFrom: string) {
  const [next] = await database
    .select({ validFrom: assignmentRates.validFrom })
    .from(assignmentRates)
    .where(
      and(
        eq(assignmentRates.projectId, ids.projectId),
        eq(assignmentRates.userId, ids.userId),
        gt(assignmentRates.validFrom, validFrom),
      ),
    )
    .orderBy(asc(assignmentRates.validFrom))
    .limit(1);
  const projectTasks = database
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, ids.projectId));
  return and(
    eq(timeEntries.userId, ids.userId),
    inArray(timeEntries.taskId, projectTasks),
    gte(timeEntries.spentOn, validFrom),
    next ? lt(timeEntries.spentOn, next.validFrom) : undefined,
  );
}

const pricedDifferently = (newRate: NewRate) =>
  or(
    isNull(timeEntries.rate),
    ne(timeEntries.rate, newRate.rate),
    ne(timeEntries.currency, newRate.currency),
  );

/** The logged entries whose price changes when the rate is added. */
export async function entriesToReprice(ids: ProjectConsultantIds, newRate: NewRate) {
  return database
    .select({
      id: timeEntries.id,
      spentOn: timeEntries.spentOn,
      task: tasks.name,
      minutes: timeEntries.minutes,
      rate: timeEntries.rate,
      currency: timeEntries.currency,
      isLocked: sql<boolean>`month_locked(${users.orgId}, ${timeEntries.spentOn})`,
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(and(await periodOf(ids, newRate.validFrom), pricedDifferently(newRate)))
    .orderBy(asc(timeEntries.spentOn), asc(tasks.name));
}

/**
 * Adds the rate and reprices the entries in its period, locked months included.
 * A rate with the same start date replaces the old one, which is how a mistake is corrected.
 */
export async function addRateAndReprice(ids: ProjectConsultantIds, newRate: NewRate) {
  const period = await periodOf(ids, newRate.validFrom);
  await database.transaction(async (transaction) => {
    await transaction
      .insert(assignmentRates)
      .values({ ...ids, validFrom: newRate.validFrom, rate: newRate.rate })
      .onConflictDoUpdate({
        target: [assignmentRates.projectId, assignmentRates.userId, assignmentRates.validFrom],
        set: { rate: newRate.rate },
      });
    await transaction
      .update(timeEntries)
      .set({ rate: newRate.rate, currency: newRate.currency })
      .where(and(period, pricedDifferently(newRate)));
  });
}
