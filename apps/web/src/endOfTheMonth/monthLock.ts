import { monthLocks, users } from "@tid/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { database } from "../database";

// Months are YYYY-MM in the app and their first day in the database.
const isActiveLock = (orgId: number, month: string) =>
  and(
    eq(monthLocks.orgId, orgId),
    eq(monthLocks.month, `${month}-01`),
    isNull(monthLocks.unlockedAt),
  );

export async function findActiveLock(orgId: number, month: string) {
  const [lock] = await database
    .select({ lockedAt: monthLocks.lockedAt, lockedBy: users.name })
    .from(monthLocks)
    .innerJoin(users, eq(users.id, monthLocks.lockedBy))
    .where(isActiveLock(orgId, month));
  return lock;
}

export async function lockMonth(orgId: number, month: string, userId: number) {
  await database
    .insert(monthLocks)
    .values({ orgId, month: `${month}-01`, lockedBy: userId })
    // Already locked, by someone else or a double-submitted form.
    .onConflictDoNothing();
}

export async function unlockMonth(orgId: number, month: string, userId: number) {
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
