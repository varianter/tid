import { projectAssignments, projects, tasks, timeEntries } from "@tid/db/schema";
import { and, between, eq, exists, or, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { database } from "../database";
import { addMonths, daysOfMonth, isIsoMonth, isWeekend, todayInOslo } from "../dates/dates";
import type { UserEnv } from "../login/user";
import { cellHours, timesheetCell } from "./timesheet.validation";
import { type CellError, MonthPage, TimesheetCell } from "./timesheet.views";

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

/** Renders the month the request names, with one cell showing an error if a save failed. */
async function renderMonth(c: Context<UserEnv>, userId: number, month: string, error?: CellError) {
  const showWeekends = c.req.query("weekends") === "on";
  const addedTaskIds = addedTaskIdsOf(c.req.queries("add"));
  const monthDays = daysOfMonth(month);
  const { tasks, entries } = await loadTimesheet(
    userId,
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
      showWeekends={showWeekends}
      previousHref={monthPath(addMonths(month, -1), showWeekends)}
      nextHref={monthPath(addMonths(month, 1), showWeekends)}
      days={days}
      tasks={tasks}
      entries={entries}
      // The query rides along, so a save can return to the same view.
      cellsAction={`/timesheet/month/${month}/cells${search}`}
      addedTaskIds={addedTaskIds}
      search={search}
      error={error}
    />,
  );
}

timesheet.get("/", (c) => c.redirect(monthPath(todayInOslo().slice(0, 7), false)));

timesheet.get("/month/:month", async (c) => {
  const user = c.get("user");
  if (!user) return c.text("Not logged in", 401);
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  return renderMonth(c, user.id, month);
});

timesheet.post("/month/:month/cells", async (c) => {
  const user = c.get("user");
  if (!user) return c.text("Not logged in", 401);
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  const body = await c.req.parseBody();
  const cell = timesheetCell.safeParse(body);
  if (!cell.success) return c.text("Bad request", 400);
  const { taskId, date } = cell.data;
  const [task] = await userTasks().where(and(eq(tasks.id, taskId), loggableBy(user.id)));
  // The grid only offers loggable tasks, so this is a stale or hand-made request.
  if (!task) return c.text("You're not on this project", 403);

  // fetch() sends "empty"; a plain form submit sends "document" and gets the whole page.
  const isFragment = c.req.header("Sec-Fetch-Dest") === "empty";
  const query = new URL(c.req.url).searchParams;
  const action = `${c.req.path}${query.size ? `?${query}` : ""}`;
  const hours = cellHours.safeParse(body.hours);
  if (!hours.success) {
    const typed = typeof body.hours === "string" ? body.hours : "";
    const message = hours.error.issues[0]?.message ?? "Enter hours, like 7,5";
    const error = { taskId, day: date, typed, message };
    c.status(422);
    if (isFragment) {
      // The totals add up what's stored, which a failed save left as it was.
      const [stored] = await database
        .select({ minutes: timeEntries.minutes })
        .from(timeEntries)
        .where(entryOn(user.id, taskId, date));
      return c.html(
        <TimesheetCell
          task={task}
          day={date}
          minutes={stored?.minutes ?? 0}
          action={action}
          error={error}
        />,
      );
    }
    return renderMonth(c, user.id, month, error);
  }

  await saveCell(user.id, taskId, date, hours.data);
  if (isFragment) {
    return c.html(<TimesheetCell task={task} day={date} minutes={hours.data} action={action} />);
  }
  const minutes = hours.data;
  // A cleared row would otherwise vanish when it held the task's last entry this month.
  if (minutes === 0 && !query.getAll("add").includes(String(taskId))) {
    query.append("add", String(taskId));
  }
  return c.redirect(`/timesheet/month/${month}${query.size ? `?${query}` : ""}`, 303);
});
