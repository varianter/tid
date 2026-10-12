import { organizations, projects, tasks, timeEntries, users } from "@tid/db/schema";
import { and, between, eq, gte, isNull, or, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { database } from "../database";
import { addMonths, daysOfMonth, isIsoMonth, todayInOslo } from "../dates/dates";
import { isManager, requireManager } from "../login/login.middleware";
import type { UserEnv } from "../login/user";
import { capacityMinutes } from "../reports/capacity";
import { EndOfTheMonthPage } from "./endOfTheMonth.views";
import { findActiveLock, lockMonth, unlockMonth } from "./monthLock";

export const endOfTheMonth = new Hono<UserEnv>();

const monthPath = (organization: string, month: string) =>
  `/end-of-the-month/${organization}/${month}`;

async function findOrganization(c: Context<UserEnv>) {
  const [organization] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, c.req.param("organization") ?? ""));
  return organization;
}

endOfTheMonth.get("/", async (c) => {
  const [organization] = await database
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, c.get("user").orgId));
  if (!organization) return c.notFound();
  return c.redirect(`/end-of-the-month/${organization.slug}`);
});

// The month being closed: last month until it's locked, then this one.
endOfTheMonth.get("/:organization", async (c) => {
  const organization = await findOrganization(c);
  if (!organization) return c.notFound();
  const thisMonth = todayInOslo().slice(0, 7);
  const lastMonth = addMonths(thisMonth, -1);
  const month = (await findActiveLock(organization.id, lastMonth)) ? thisMonth : lastMonth;
  return c.redirect(monthPath(organization.slug, month));
});

endOfTheMonth.get("/:organization/:month", async (c) => {
  const month = c.req.param("month");
  const organization = await findOrganization(c);
  if (!organization || !isIsoMonth(month)) return c.notFound();

  const days = daysOfMonth(month);
  const first = days[0] ?? "";
  const last = days.at(-1) ?? "";
  const today = todayInOslo();

  const consultants = await database
    .select({
      id: users.id,
      name: users.name,
      endsOn: users.endsOn,
      minutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
      billableMinutes:
        sql`coalesce(sum(${timeEntries.minutes}) filter (where ${projects.billable}), 0)`.mapWith(
          Number,
        ),
    })
    .from(users)
    .leftJoin(
      timeEntries,
      and(eq(timeEntries.userId, users.id), between(timeEntries.spentOn, first, last)),
    )
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(eq(users.orgId, organization.id), or(isNull(users.endsOn), gte(users.endsOn, first))),
    )
    .groupBy(users.id)
    .orderBy(users.name);

  const rows = consultants.map((consultant) => {
    // Hours not yet due don't count as missing, so the current month only checks up to today.
    const until = consultant.endsOn && consultant.endsOn < today ? consultant.endsOn : today;
    const expectedMinutes = capacityMinutes(month, organization.fullDayMinutes, until);
    return {
      name: consultant.name,
      minutes: consultant.minutes,
      billableMinutes: consultant.billableMinutes,
      expectedMinutes,
      missingMinutes: Math.max(expectedMinutes - consultant.minutes, 0),
    };
  });

  return c.render(
    <EndOfTheMonthPage
      organization={organization.name}
      month={month}
      rows={rows}
      lock={await findActiveLock(organization.id, month)}
      canLock={await isManager(c.get("user").id)}
      lockAction={`${monthPath(organization.slug, month)}/lock`}
      unlockAction={`${monthPath(organization.slug, month)}/unlock`}
      previousHref={monthPath(organization.slug, addMonths(month, -1))}
      nextHref={monthPath(organization.slug, addMonths(month, 1))}
    />,
  );
});

endOfTheMonth.post("/:organization/:month/lock", requireManager, async (c) => {
  const month = c.req.param("month");
  const organization = await findOrganization(c);
  if (!organization || !isIsoMonth(month)) return c.notFound();
  await lockMonth(organization.id, month, c.get("user").id);
  return c.redirect(monthPath(organization.slug, month), 303);
});

endOfTheMonth.post("/:organization/:month/unlock", requireManager, async (c) => {
  const month = c.req.param("month");
  const organization = await findOrganization(c);
  if (!organization || !isIsoMonth(month)) return c.notFound();
  await unlockMonth(organization.id, month, c.get("user").id);
  return c.redirect(monthPath(organization.slug, month), 303);
});
