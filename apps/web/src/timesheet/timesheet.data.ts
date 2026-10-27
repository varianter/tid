import { firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { timeEntries } from "@tid/db/schema";
import { and, between, eq } from "drizzle-orm";
import type { User } from "../domain/users/user";
import { database } from "../framework/database";
import { isLockedOn } from "../monthClose/monthLock.data";
import { offeredTo, onBillableAssignment, userTasks } from "./loggableTasks";

/**
 * The user's entries in the month, the tasks the timesheet offers them, those it shows unasked
 * unless `showBillableAssignments` is false, and whether the month is locked.
 */
export async function loadTimesheet(
  user: Pick<User, "id" | "orgId">,
  month: string,
  showBillableAssignments: boolean,
) {
  const from = firstDayOfMonth(month);
  const till = lastDayOfMonth(month);
  const [entries, assignedTasks, tasks, locked] = await Promise.all([
    database
      .select({
        taskId: timeEntries.taskId,
        spentOn: timeEntries.spentOn,
        minutes: timeEntries.minutes,
      })
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, user.id), between(timeEntries.spentOn, from, till))),
    showBillableAssignments ? userTasks().where(onBillableAssignment(user.id, from)) : [],
    userTasks().where(offeredTo(user.id, from, till)),
    isLockedOn(user.orgId, from),
  ]);
  return { tasks, entries, assignedTaskIds: assignedTasks.map((task) => task.id), locked };
}
