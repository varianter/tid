import { projectAssignments, projects, tasks, timeEntries } from "@tid/db/schema";
import { and, between, eq, exists, or, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { database } from "../database";
import {
  addMonths,
  daysOfMonth,
  formatMonth,
  isIsoMonth,
  isWeekend,
  todayInOslo,
} from "../dates/dates";
import { isLockedOn } from "../endOfTheMonth/monthLock";
import type { User, UserEnv } from "../login/user";
import { cellHours, hoursHint, timesheetCell } from "./timesheet.validation";
import { type MonthError, MonthPage, TimesheetCell } from "./timesheet.views";

export const timesheet = new Hono<UserEnv>();

/** Tasks the user may log on: open projects, assigned ones, and any they already have time on. */
const loggableBy = (userId: number) =>
  or(
    eq(projects.openToEveryone, true),
    exists(
      database
        .select()
        .from(projectAssignments)
        .where(
          and(eq(projectAssignments.projectId, projects.id), eq(projectAssignments.userId, userId)),
        ),
    ),
    // Keeps rows for tasks the user is no longer assigned to, so they can still correct them.
    exists(
      database
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.taskId, tasks.id), eq(timeEntries.userId, userId))),
    ),
  );

const userTasks = () =>
  database
    .select({ id: tasks.id, name: tasks.name, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId));

/** The user's entries between from and till, and every task they may log on. */
async function loadTimesheet(userId: number, from: string, till: string) {
  const entries = await database
    .select({
      taskId: timeEntries.taskId,
      spentOn: timeEntries.spentOn,
      minutes: timeEntries.minutes,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), between(timeEntries.spentOn, from, till)));
  return { tasks: await userTasks().where(loggableBy(userId)), entries };
}

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

const addedTaskIdsOf = (queries: string[] | undefined) => (queries ?? []).map(Number);

const monthPath = (month: string, showWeekends: boolean) =>
  `/timesheet/month/${month}${showWeekends ? "?weekends=on" : ""}`;

// The query rides along, so a save can return to the same view.
const cellsActionOf = (month: string, search: string) => `/timesheet/month/${month}/cells${search}`;

/** Renders the month the request names, with one cell showing an error if a save failed. */
async function renderMonth(c: Context<UserEnv>, month: string, error?: MonthError) {
  const showWeekends = c.req.query("weekends") === "on";
  const addedTaskIds = addedTaskIdsOf(c.req.queries("add"));
  const monthDays = daysOfMonth(month);
  const { tasks, entries } = await loadTimesheet(
    c.get("user").id,
    monthDays[0] ?? "",
    monthDays.at(-1) ?? "",
  );
  // A weekend with hours stays visible, so hiding weekends never hides time.
  const days = monthDays.filter(
    (day) => showWeekends || !isWeekend(day) || entries.some((entry) => entry.spentOn === day),
  );
  const search = new URL(c.req.url).search;

  return c.render(
    <MonthPage
      month={month}
      locked={await isLockedOn(c.get("user").orgId, `${month}-01`)}
      showWeekends={showWeekends}
      previousHref={monthPath(addMonths(month, -1), showWeekends)}
      nextHref={monthPath(addMonths(month, 1), showWeekends)}
      days={days}
      tasks={tasks}
      entries={entries}
      cellsAction={cellsActionOf(month, search)}
      cellAction={`/timesheet/month/${month}/cell${search}`}
      addedTaskIds={addedTaskIds}
      search={search}
      error={error}
    />,
  );
}

timesheet.get("/", (c) => c.redirect(monthPath(todayInOslo().slice(0, 7), false)));

timesheet.get("/month/:month", async (c) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  return renderMonth(c, month);
});

/**
 * The cell a save posted, once the user may log on its task, or the response refusing it.
 * The hours are left to the caller, since a route answers them its own way.
 */
async function readPostedCell(c: Context<UserEnv>) {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const cell = timesheetCell.safeParse(body);
  if (!cell.success) return c.text("Bad request", 400);
  const [task] = await userTasks().where(and(eq(tasks.id, cell.data.taskId), loggableBy(user.id)));
  // The grid only offers loggable tasks, so this is a stale or hand-made request.
  if (!task) return c.text("You're not on this project", 403);
  return { user, task, day: cell.data.date, hours: body.hours };
}

/** Saves the hours as minutes, or says why they can't be: what was typed and what's wrong. */
async function saveHours(user: User, taskId: number, day: string, hours: unknown) {
  const typed = typeof hours === "string" ? hours : "";
  // The database refuses these too; checking first lets the cell say why.
  if (await isLockedOn(user.orgId, day)) {
    return { error: { typed, message: `${formatMonth(day.slice(0, 7))} is locked` } };
  }
  const minutes = cellHours.safeParse(hours);
  if (!minutes.success) {
    return { error: { typed, message: minutes.error.issues[0]?.message ?? hoursHint } };
  }
  await saveCell(user.id, taskId, day, minutes.data);
  return { minutes: minutes.data };
}

// Saves from a page without the timesheet element: the whole month comes back.
timesheet.post("/month/:month/cells", async (c) => {
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
});

// Saves from the timesheet element: only the cell comes back, as stored, for it to swap in.
timesheet.post("/month/:month/cell", async (c) => {
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
    />,
    error ? 422 : 200,
  );
});
