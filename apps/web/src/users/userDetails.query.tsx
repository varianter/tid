import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, daysOfMonth, isIsoMonth } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import {
  clients,
  organizations,
  projects,
  tasks,
  timeEntries,
  userRoles,
  users,
} from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { Badge, EmptyState, Page, PeriodNavigation } from "@tid/ui";
import { and, desc, eq, exists, gte, lte, sql } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { capacityMinutes } from "../reports/capacity";
import { isManager } from "./manager";
import { userIdParam, userPath, usersPath } from "./usersUrl";

export const userDetails = async (c: Context<UserEnv>) => {
  const userId = userIdParam(c);
  if (userId === undefined) return c.notFound();
  const viewer = c.get("user");
  const viewerIsManager = await isManager(viewer);
  if (viewer.id !== userId && !viewerIsManager) {
    return c.text("Only managers can see other users", 403);
  }
  const [user] = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      endsOn: users.endsOn,
      organizationSlug: organizations.slug,
      country: organizations.country,
      fullDayMinutes: organizations.fullDayMinutes,
      isManager: exists(
        database
          .select()
          .from(userRoles)
          .where(and(eq(userRoles.userId, users.id), eq(userRoles.role, "manager"))),
      ).mapWith(Boolean),
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.id, userId));
  if (!user) return c.notFound();

  const monthQuery = c.req.query("month");
  const month = monthQuery && isIsoMonth(monthQuery) ? monthQuery : todayInOslo().slice(0, 7);
  const days = daysOfMonth(month);
  const inMonth = and(
    eq(timeEntries.userId, user.id),
    gte(timeEntries.spentOn, days[0] ?? ""),
    lte(timeEntries.spentOn, days.at(-1) ?? ""),
  );
  const [monthTotals] = await database
    .select({
      minutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
      billableMinutes: sql`coalesce(sum(${timeEntries.minutes}) filter (
        where ${projects.billing} <> 'non_billable'
      ), 0)`.mapWith(Number),
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(inMonth);

  const entries = await database
    .select({
      spentOn: timeEntries.spentOn,
      minutes: timeEntries.minutes,
      notes: timeEntries.notes,
      task: tasks.name,
      project: projects.name,
      client: clients.name,
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(inMonth)
    .orderBy(desc(timeEntries.spentOn), projects.name, tasks.name);

  return c.render(
    <Page
      title={user.name}
      back={
        viewerIsManager ? { href: usersPath(user.organizationSlug), label: "Users" } : undefined
      }
      actions={
        <PeriodNavigation
          previousHref={userPath(user.id, addMonths(month, -1))}
          nextHref={userPath(user.id, addMonths(month, 1))}
          previousLabel="Previous month"
          nextLabel="Next month"
        >
          {formatDate(month, "month")}
        </PeriodNavigation>
      }
    >
      <p class="stack-h gap-xs items-center ink-subtle">
        {user.email}
        {user.isManager && <Badge>Manager</Badge>}
        {user.endsOn && <span>· Left {formatDate(user.endsOn)}</span>}
      </p>
      <div class="stack-h items-start gap-m">
        <MonthHours
          minutes={monthTotals?.minutes ?? 0}
          billableMinutes={monthTotals?.billableMinutes ?? 0}
          capacityMinutes={capacityMinutes(month, user.country, user.fullDayMinutes, user.endsOn)}
        />
        <MonthEntries month={month} entries={entries} />
      </div>
    </Page>,
  );
};

const billableColor = "var(--palette-blue-500)";
const nonBillableColor = "var(--palette-blue-250)";

function MonthHours({
  minutes,
  billableMinutes,
  capacityMinutes,
}: {
  minutes: number;
  billableMinutes: number;
  capacityMinutes: number;
}) {
  const nonBillableMinutes = minutes - billableMinutes;
  // Overtime stretches the bar past capacity rather than spilling out of it.
  const scale = Math.max(minutes, capacityMinutes) || 1;
  const width = (part: number) => `${(part / scale) * 100}%`;
  return (
    <section class="stack-v gap-m flex-1 b-all bc-default br-l p-m t-tabular">
      <dl class="stack-h items-start gap-xl">
        <div class="stack-v gap-3xs flex-1">
          <dt class="fs-s ink-subtle">Total hours</dt>
          <dd class="fs-l fw-medium">{formatTotalHours(minutes)}</dd>
        </div>
        <div class="stack-v gap-3xs flex-1">
          <dt class="fs-s ink-subtle">Capacity</dt>
          <dd class="fs-l fw-medium">{formatTotalHours(capacityMinutes)}</dd>
        </div>
      </dl>
      <div
        class="stack-h nowrap gap-none br-s of-hidden b-all bc-subtle"
        style="height: 1.5rem;"
        aria-hidden="true"
      >
        <span
          style={`height: 100%; width: ${width(billableMinutes)}; background: ${billableColor};`}
        />
        <span
          style={`height: 100%; width: ${width(nonBillableMinutes)}; background: ${nonBillableColor};`}
        />
      </div>
      <dl class="stack-v gap-xs">
        <LegendRow color={billableColor} label="Billable" minutes={billableMinutes} />
        <LegendRow color={nonBillableColor} label="Non-billable" minutes={nonBillableMinutes} />
      </dl>
    </section>
  );
}

function LegendRow({ color, label, minutes }: { color: string; label: string; minutes: number }) {
  return (
    <div class="stack-h nowrap items-center gap-xs">
      <dt class="stack-h nowrap items-center gap-xs flex-1">
        <span class="br-xs" style={`width: 1rem; height: 1rem; background: ${color};`} />
        {label}
      </dt>
      <dd class="fw-medium">{formatTotalHours(minutes)}</dd>
    </div>
  );
}

type Entry = {
  spentOn: string;
  minutes: number;
  notes: string | null;
  task: string;
  project: string;
  client: string;
};

function MonthEntries({ month, entries }: { month: string; entries: Entry[] }) {
  const days = Map.groupBy(entries, (entry) => entry.spentOn);
  return (
    <section class="stack-v gap-m flex-1">
      <h2 class="fs-m">Entries</h2>
      {days.size === 0 ? (
        <EmptyState emoji="🗓️" title="No hours logged">
          No time was logged in {formatDate(month, "month")}.
        </EmptyState>
      ) : (
        [...days].map(([day, dayEntries]) => (
          <div class="stack-v b-all bc-subtle br-l p-xs t-tabular">
            <h3 class="stack-h items-baseline b-b bc-subtle p-xs fs-s fw-bold">
              <span class="flex-1">{formatDate(day)}</span>
              <span>
                {formatTotalHours(dayEntries.reduce((sum, entry) => sum + entry.minutes, 0))}
              </span>
            </h3>
            {dayEntries.map((entry) => (
              <div class="stack-h nowrap items-start gap-m p-xs fs-s">
                <span class="stack-v gap-4xs flex-1">
                  <span class="fw-medium">
                    {entry.project} <span class="ink-subtle fw-regular">({entry.client})</span>
                  </span>
                  <span>{entry.task}</span>
                  {entry.notes && <span class="ink-subtle">{entry.notes}</span>}
                </span>
                <span>{formatTotalHours(entry.minutes)}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
