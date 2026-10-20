import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, daysOfMonth, isIsoMonth } from "@tid/calendar/isoDate";
import { isoDateInOslo, todayInOslo } from "@tid/calendar/osloClock";
import { projects, tasks, timeEntries, users } from "@tid/db/schema";
import { formatHours } from "@tid/elements/hours";
import { DataGrid, Page, PeriodNavigation } from "@tid/ui";
import { and, between, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { countryVisibility, managesOrganization } from "../managers/manager";
import { findOrganizationSlug } from "../organizations/organization";
import {
  listOrganizations,
  type OrganizationOption,
  OrganizationSelect,
} from "../organizations/organizationSelect";
import { capacityMinutes } from "../reports/capacity";
import { formatShare } from "../share/share";
import { LockMonthForm } from "./lockMonth.command";
import { findActiveLock } from "./monthLock";
import { findOrganization, monthPath } from "./monthUrl";
import { UnlockMonthForm } from "./unlockMonth.command";

// The month being closed: last month until it's locked, then this one.
// Without an organization in the URL, it's the one picked, or else the user's own.
export const monthDetailsRedirect = async (c: Context<UserEnv>) => {
  if (!c.req.param("organization")) {
    const slug = c.req.query("organization") || (await findOrganizationSlug(c.get("user").orgId));
    if (!slug) return c.notFound();
    const month = c.req.query("month") ?? "";
    return c.redirect(isIsoMonth(month) ? monthPath(slug, month) : `/end-of-the-month/${slug}`);
  }
  const organization = await findOrganization(c);
  if (!organization) return c.notFound();
  const thisMonth = todayInOslo().slice(0, 7);
  const lastMonth = addMonths(thisMonth, -1);
  const month = (await findActiveLock(organization.id, lastMonth)) ? thisMonth : lastMonth;
  return c.redirect(monthPath(organization.slug, month));
};

export const monthDetails = async (c: Context<UserEnv>) => {
  const month = c.req.param("month") ?? "";
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
        sql`coalesce(sum(${timeEntries.minutes}) filter (where ${projects.billing} <> 'non_billable'), 0)`.mapWith(
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
    const expectedMinutes = capacityMinutes(
      month,
      organization.country,
      organization.fullDayMinutes,
      until,
    );
    return {
      name: consultant.name,
      minutes: consultant.minutes,
      billableMinutes: consultant.billableMinutes,
      expectedMinutes,
      missingMinutes: Math.max(expectedMinutes - consultant.minutes, 0),
    };
  });

  const [activeLock, canChangeLock, organizationOptions, canViewCountry] = await Promise.all([
    findActiveLock(organization.id, month),
    managesOrganization(c.get("user"), organization.id),
    listOrganizations(),
    countryVisibility(c.get("user")),
  ]);
  return c.render(
    <MonthDetailsPage
      organizations={organizationOptions.filter((option) => canViewCountry(option.country))}
      organizationSlug={organization.slug}
      month={month}
      rows={rows}
      activeLock={activeLock}
      canChangeLock={canChangeLock}
      previousHref={monthPath(organization.slug, addMonths(month, -1))}
      nextHref={monthPath(organization.slug, addMonths(month, 1))}
    />,
  );
};

type ConsultantRow = {
  name: string;
  minutes: number;
  billableMinutes: number;
  expectedMinutes: number;
  missingMinutes: number;
};

function MonthDetailsPage({
  organizations,
  organizationSlug,
  month,
  rows,
  activeLock,
  canChangeLock,
  previousHref,
  nextHref,
}: {
  organizations: OrganizationOption[];
  organizationSlug: string;
  month: string;
  rows: ConsultantRow[];
  activeLock?: { lockedAt: Date; lockedByName: string };
  canChangeLock: boolean;
  previousHref: string;
  nextHref: string;
}) {
  return (
    <Page
      title="End of the month"
      actions={
        <>
          <OrganizationSelect
            organizationSlug={organizationSlug}
            organizations={organizations}
            action="/end-of-the-month"
            keep={{ month }}
          />
          <PeriodNavigation
            previousHref={previousHref}
            nextHref={nextHref}
            previousLabel="Previous month"
            nextLabel="Next month"
          >
            {formatDate(month, "month")}
          </PeriodNavigation>
        </>
      }
    >
      <section class="stack-h items-center gap-m b-all bc-default br-l py-xs px-m">
        <span class={activeLock ? "fw-medium" : "ink-subtle"}>
          {activeLock
            ? `Locked by ${activeLock.lockedByName}, ${formatDate(isoDateInOslo(activeLock.lockedAt))}`
            : `${formatDate(month, "month")} is open`}
        </span>
        {canChangeLock &&
          (activeLock ? (
            <UnlockMonthForm organizationSlug={organizationSlug} month={month} />
          ) : (
            <LockMonthForm organizationSlug={organizationSlug} month={month} />
          ))}
      </section>
      <ConsultantTable
        title="Still missing hours"
        showMissing
        rows={rows
          .filter((row) => row.missingMinutes > 0)
          .sort((a, b) => b.missingMinutes - a.missingMinutes)}
      />
      <ConsultantTable
        title="All hours logged"
        rows={rows.filter((row) => row.missingMinutes === 0)}
      />
    </Page>
  );
}

function ConsultantTable({
  title,
  rows,
  showMissing = false,
}: {
  title: string;
  rows: ConsultantRow[];
  showMissing?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section class="stack-v gap-s">
      <h2 class="fs-l fw-bold">{title}</h2>
      <DataGrid
        columns={[
          { label: "Consultant" },
          { label: "Logged", kind: "number" },
          { label: "Billable share", kind: "number" },
          { label: "Expected", kind: "number" },
          showMissing && { label: "Missing", kind: "number" },
        ]}
      >
        {rows.map((row) => (
          <DataGrid.Row>
            <DataGrid.Title>{row.name}</DataGrid.Title>
            {formatTotal(row.minutes)}
            {formatShare(row.billableMinutes, row.minutes)}
            <span class="ink-subtle">{formatTotal(row.expectedMinutes)}</span>
            {showMissing && formatTotal(row.missingMinutes)}
          </DataGrid.Row>
        ))}
      </DataGrid>
    </section>
  );
}

/** Unlike a timesheet cell, an empty total still reads as zero. */
function formatTotal(minutes: number) {
  return `${formatHours(minutes) || "0"} h`;
}
