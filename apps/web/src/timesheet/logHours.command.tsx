import { tasks, timeEntries } from "@tid/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { formatMonth } from "../dates/dateDisplay";
import { isIsoMonth } from "../dates/isoDate";
import { isLockedOn, isMonthLockedError } from "../endOfTheMonth/monthLock";
import type { User, UserEnv } from "../login/user";
import { loggableBy, userTasks } from "./loggableTasks";
import { cellsActionOf, renderMonth } from "./monthPage";
import { cellFields, cellHours, hoursHint, TimesheetCell } from "./timesheetCell";

const entryOn = (userId: number, taskId: number, spentOn: string) =>
  and(
    eq(timeEntries.userId, userId),
    eq(timeEntries.taskId, taskId),
    eq(timeEntries.spentOn, spentOn),
  );

/** Stores the cell's minutes, deleting the entry when they're zero. */
async function saveCell(userId: number, taskId: number, spentOn: string, minutes: number) {
  if (minutes === 0) {
    await database.delete(timeEntries).where(entryOn(userId, taskId, spentOn));
    return;
  }
  // New entries are priced here; only moving an entry to another task reprices it later.
  const rate = sql`entry_rate(${userId}, ${taskId}, ${spentOn})`;
  await database
    .insert(timeEntries)
    .values({
      userId,
      taskId,
      spentOn,
      minutes,
      rate: sql`(select rate from ${rate})`,
      currency: sql`(select currency from ${rate})`,
    })
    .onConflictDoUpdate({
      target: [timeEntries.userId, timeEntries.taskId, timeEntries.spentOn],
      set: { minutes },
    });
}

/**
 * The cell a save posted, once the user may log on its task, or the response refusing it.
 * The hours are left to the caller, since each save answers them its own way.
 */
async function readPostedCell(c: Context<UserEnv>) {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const cell = cellFields.safeParse(body);
  if (!cell.success) return c.text("Bad request", 400);
  const [task] = await userTasks().where(and(eq(tasks.id, cell.data.taskId), loggableBy(user.id)));
  // The grid only offers loggable tasks, so this is a stale or hand-made request.
  if (!task) return c.text("You're not on this project", 403);
  return { user, task, day: cell.data.date, hours: body.hours };
}

/** Saves the hours as minutes, or says why they can't be: what was typed and what's wrong. */
async function saveHours(user: User, taskId: number, day: string, hours: unknown) {
  const typed = typeof hours === "string" ? hours : "";
  const minutes = cellHours.safeParse(hours);
  if (!minutes.success) {
    return { error: { typed, message: minutes.error.issues[0]?.message ?? hoursHint } };
  }
  try {
    await saveCell(user.id, taskId, day, minutes.data);
  } catch (error) {
    if (!isMonthLockedError(error)) throw error;
    return { error: { typed, message: `${formatMonth(day.slice(0, 7))} is locked` } };
  }
  return { minutes: minutes.data };
}

// Saves from a page without the timesheet element: the whole month comes back.
export const logHours = async (c: Context<UserEnv, "/month/:month">) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  const cell = await readPostedCell(c);
  if (cell instanceof Response) return cell;
  const { user, task, day } = cell;
  const saved = await saveHours(user, task.id, day, cell.hours);
  if (saved.error) {
    c.status(422);
    return renderMonth(c, month, { taskId: task.id, day, ...saved.error });
  }
  const query = new URL(c.req.url).searchParams;
  // A cleared row would otherwise vanish when it held the task's last entry this month.
  if (saved.minutes === 0 && !query.getAll("add").includes(String(task.id))) {
    query.append("add", String(task.id));
  }
  return c.redirect(`/timesheet/month/${month}${query.size ? `?${query}` : ""}`, 303);
};

// Saves from the timesheet element: only the cell comes back, as stored, for it to swap in.
export const logHoursInPlace = async (c: Context<UserEnv, "/month/:month">) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  const cell = await readPostedCell(c);
  if (cell instanceof Response) return cell;
  const { user, task, day } = cell;
  const { error } = await saveHours(user, task.id, day, cell.hours);
  const [stored] = await database
    .select({ minutes: timeEntries.minutes })
    .from(timeEntries)
    .where(entryOn(user.id, task.id, day));
  return c.html(
    <TimesheetCell
      task={task}
      day={day}
      minutes={stored?.minutes ?? 0}
      action={cellsActionOf(month, new URL(c.req.url).search)}
      error={error}
      // A save refused by a new lock leaves the cell read-only, like the rest of the month.
      locked={error ? await isLockedOn(user.orgId, day) : false}
    />,
    error ? 422 : 200,
  );
};
