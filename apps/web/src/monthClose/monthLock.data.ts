import { addMonths, firstDayOfMonth } from "@tid/calendar/isoDate";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { monthLocks, organizations, users } from "@tid/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { database } from "../framework/database";

// Months are YYYY-MM in the app and their first day in the database.
const locksMonth = (month: string) =>
  and(eq(monthLocks.month, firstDayOfMonth(month)), isNull(monthLocks.unlockedAt));

const isActiveLock = (orgId: number, month: string) =>
  and(eq(monthLocks.orgId, orgId), locksMonth(month));

export async function findActiveLock(orgId: number, month: string) {
  const [lock] = await database
    .select({ lockedAt: monthLocks.lockedAt, lockedByName: users.name })
    .from(monthLocks)
    .innerJoin(users, eq(users.id, monthLocks.lockedBy))
    .where(isActiveLock(orgId, month));
  return lock;
}

/** The month an organization is closing: last month until it's locked, then this one. */
export async function findMonthBeingClosed(orgId: number) {
  const thisMonth = thisMonthInOslo();
  const lastMonth = addMonths(thisMonth, -1);
  return (await findActiveLock(orgId, lastMonth)) ? thisMonth : lastMonth;
}

/** How many organizations there are, and how many of them have locked `month`. */
export async function countLockedOrganizations(month: string) {
  const [row] = await database
    .select({
      organizations: sql`count(*)`.mapWith(Number),
      locked: sql`count(${monthLocks.orgId})`.mapWith(Number),
    })
    .from(organizations)
    .leftJoin(monthLocks, and(eq(monthLocks.orgId, organizations.id), locksMonth(month)));
  return row ?? { organizations: 0, locked: 0 };
}

export async function addLock(orgId: number, month: string, userId: number) {
  await database
    .insert(monthLocks)
    .values({ orgId, month: firstDayOfMonth(month), lockedBy: userId })
    // Already locked, by someone else or a double-submitted form.
    .onConflictDoNothing();
}

export async function liftLock(orgId: number, month: string, userId: number) {
  await database
    .update(monthLocks)
    .set({ unlockedBy: userId, unlockedAt: sql`now()` })
    .where(isActiveLock(orgId, month));
}

/** Whether the day's month is locked, as the database's own lock check sees it. */
export async function isLockedOn(orgId: number, day: string) {
  const [row] = await database.execute<{ locked: boolean }>(
    sql`select month_locked(${orgId}, ${day}) as locked`,
  );
  return row?.locked ?? false;
}

/** Whether the error is the database refusing to change an entry in a locked month. */
export function isMonthLockedError(error: unknown) {
  // migrations/0004_month_locks.sql raises TL001; Bun puts the SQLSTATE in errno, under Drizzle's wrapper.
  return (
    error instanceof Error && (error.cause as { errno?: string } | undefined)?.errno === "TL001"
  );
}
