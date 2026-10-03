import { projectAssignments, projects, tasks, timeEntries } from "@tid/db/schema";
import { and, between, eq, exists, or } from "drizzle-orm";
import { Hono } from "hono";
import { database } from "../database";
import {
  addDays,
  addMonths,
  daysOfMonth,
  daysOfWeek,
  isIsoDate,
  isIsoMonth,
  isWeekend,
  mondayOf,
  todayInOslo,
} from "../dates/dates";
import type { UserEnv } from "../login/user";
import { MonthPage, WeekPage } from "./timesheet.views";

export const timesheet = new Hono<UserEnv>();

/** The user's entries between from and till, and every task they may log on or already have. */
async function loadTimesheet(userId: number, from: string, till: string) {
  const entries = await database
    .select({
      taskId: timeEntries.taskId,
      spentOn: timeEntries.spentOn,
      minutes: timeEntries.minutes,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), between(timeEntries.spentOn, from, till)));
  const userTasks = await database
    .select({ id: tasks.id, name: tasks.name, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      or(
        eq(projects.openToEveryone, true),
        exists(
          database
            .select()
            .from(projectAssignments)
            .where(
              and(
                eq(projectAssignments.projectId, projects.id),
                eq(projectAssignments.userId, userId),
              ),
            ),
        ),
        // Keeps rows for tasks the user is no longer assigned to.
        exists(
          database
            .select()
            .from(timeEntries)
            .where(and(eq(timeEntries.taskId, tasks.id), eq(timeEntries.userId, userId))),
        ),
      ),
    );
  return { tasks: userTasks, entries };
}

const addedTaskIdsOf = (queries: string[] | undefined) => (queries ?? []).map(Number);

const weekPath = (monday: string) => `/timesheet/week/${monday}`;
const monthPath = (month: string, showWeekends: boolean) =>
  `/timesheet/month/${month}${showWeekends ? "?weekends=on" : ""}`;

timesheet.get("/", (c) => c.redirect(weekPath(mondayOf(todayInOslo()))));

timesheet.get("/week/:date", async (c) => {
  const user = c.get("user");
  if (!user) return c.text("Not logged in", 401);
  const date = c.req.param("date");
  if (!isIsoDate(date)) return c.notFound();
  const monday = mondayOf(date);
  if (date !== monday) return c.redirect(weekPath(monday));
  const days = daysOfWeek(monday);
  const { tasks, entries } = await loadTimesheet(user.id, monday, addDays(monday, 6));

  return c.render(
    <WeekPage
      monday={monday}
      sunday={addDays(monday, 6)}
      previousHref={weekPath(addDays(monday, -7))}
      nextHref={weekPath(addDays(monday, 7))}
      days={days}
      tasks={tasks}
      entries={entries}
      cellsAction={`${weekPath(monday)}/cells`}
      addedTaskIds={addedTaskIdsOf(c.req.queries("add"))}
      search={new URL(c.req.url).search}
    />,
  );
});

timesheet.get("/month", (c) => c.redirect(monthPath(todayInOslo().slice(0, 7), false)));

timesheet.get("/month/:month", async (c) => {
  const user = c.get("user");
  if (!user) return c.text("Not logged in", 401);
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  const showWeekends = c.req.query("weekends") === "on";
  const addedTaskIds = addedTaskIdsOf(c.req.queries("add"));
  const monthDays = daysOfMonth(month);
  const { tasks, entries } = await loadTimesheet(
    user.id,
    monthDays[0] ?? "",
    monthDays.at(-1) ?? "",
  );
  // A weekend with hours stays visible, so hiding weekends never hides time.
  const days = monthDays.filter(
    (day) => showWeekends || !isWeekend(day) || entries.some((entry) => entry.spentOn === day),
  );

  return c.render(
    <MonthPage
      month={month}
      showWeekends={showWeekends}
      previousHref={monthPath(addMonths(month, -1), showWeekends)}
      nextHref={monthPath(addMonths(month, 1), showWeekends)}
      days={days}
      tasks={tasks}
      entries={entries}
      cellsAction={`/timesheet/month/${month}/cells`}
      addedTaskIds={addedTaskIds}
      search={new URL(c.req.url).search}
    />,
  );
});
