import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { isoDateInOslo, thisMonthInOslo, todayInOslo } from "@tid/calendar/osloClock";
import { projects, tasks, timeEntries, users } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import {
  ColorMode,
  DataGrid,
  EmptyState,
  Icon,
  type IconName,
  Page,
  type Palette,
  PeriodNavigation,
  Stat,
  StatList,
} from "@tid/ui";
import { and, between, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { Context } from "hono";
import { BillableBar } from "../billable/billableBar";
import { consultantPath } from "../consultants/consultantsUrl";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { isManager, managesOrganization } from "../managers/manager";
import {
  type Company,
  type CompanyFilter,
  CompanySelect,
  resolveCompany,
} from "../organizations/companyFilter";
import { type QueryProps, queryPage } from "../query/queryPage";
import { capacityMinutes } from "../reports/capacity";
import { UtilizationBar } from "../reports/utilizationBar";
import { formatShare } from "../share/share";
import { LockMonthForm } from "./lockMonth.form";
import { findActiveLock } from "./monthLock.data";
import { monthUrl } from "./monthUrl";
import { UnlockMonthForm } from "./unlockMonth.form";

// Months are locked per organization, so a whole country has no month close.
const organizationOf = (company: Company) =>
  company.organizations.length === 1 ? company.organizations[0] : undefined;

// The month being closed: last month until it's locked, then this one.
export const monthDetailsRedirect = async (c: Context<UserEnv>) => {
  const company = await resolveCompany(c);
  if (company instanceof Response) return company;
  const organization = organizationOf(company.selected);
  if (!organization) return c.notFound();
  const thisMonth = thisMonthInOslo();
  const lastMonth = addMonths(thisMonth, -1);
  const month = (await findActiveLock(organization.id, lastMonth)) ? thisMonth : lastMonth;
  return c.redirect(monthUrl.path({ month, company: company.selected.value }));
};

export const monthDetails = queryPage({
  url: monthUrl,
  loader: async (c: Context<UserEnv>, { month }) => {
    const company = await resolveCompany(c);
    if (company instanceof Response) return company;
    const organization = organizationOf(company.selected);
    if (!organization) return c.notFound();

    const first = firstDayOfMonth(month);
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
        and(
          eq(timeEntries.userId, users.id),
          between(timeEntries.spentOn, first, lastDayOfMonth(month)),
        ),
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
        id: consultant.id,
        name: consultant.name,
        minutes: consultant.minutes,
        billableMinutes: consultant.billableMinutes,
        expectedMinutes,
        missingMinutes: Math.max(expectedMinutes - consultant.minutes, 0),
      };
    });

    const [activeLock, canChangeLock, viewerIsManager] = await Promise.all([
      findActiveLock(organization.id, month),
      managesOrganization(c.get("user"), organization.id),
      isManager(c.get("user")),
    ]);
    return {
      company: {
        selected: company.selected,
        companies: company.companies.filter((option) => organizationOf(option)),
      },
      organizationSlug: organization.slug,
      rows,
      canOpenConsultants: viewerIsManager,
      activeLock,
      canChangeLock,
    };
  },
  view: MonthDetailsPage,
});

type ConsultantRow = {
  id: number;
  name: string;
  minutes: number;
  billableMinutes: number;
  expectedMinutes: number;
  missingMinutes: number;
};

function MonthDetailsPage({
  company,
  organizationSlug,
  rows,
  canOpenConsultants,
  activeLock,
  canChangeLock,
  query: { month },
  href,
}: {
  company: CompanyFilter;
  organizationSlug: string;
  rows: ConsultantRow[];
  canOpenConsultants: boolean;
  activeLock?: { lockedAt: Date; lockedByName: string };
  canChangeLock: boolean;
} & QueryProps<typeof monthUrl>) {
  const loggedMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const expectedMinutes = rows.reduce((sum, row) => sum + row.expectedMinutes, 0);
  const billableMinutes = rows.reduce((sum, row) => sum + row.billableMinutes, 0);
  const missingCount = rows.filter((row) => row.missingMinutes > 0).length;
  // Months are usually locked on their last day, once that day's hours are in.
  const isDueForLock = lastDayOfMonth(month) <= todayInOslo();
  const lockStatus = activeLock
    ? "locked"
    : isDueForLock && missingCount === 0
      ? "ready to lock"
      : "open";
  return (
    <Page
      title="Month close"
      actions={
        <>
          <CompanySelect {...company} />
          <PeriodNavigation
            previousHref={href({ month: addMonths(month, -1) })}
            nextHref={href({ month: addMonths(month, 1) })}
            previousLabel="Previous month"
            nextLabel="Next month"
          >
            {formatDate(month, "month")}
          </PeriodNavigation>
        </>
      }
    >
      <div class="stack-v gap-s">
        {rows.length === 0 ? (
          <EmptyState emoji="👥" title="No consultants yet" />
        ) : (
          <StatList>
            <Stat
              label="Logged"
              value={formatTotalHours(loggedMinutes)}
              share={formatShare(loggedMinutes, expectedMinutes)}
              note={`of ${formatTotalHours(expectedMinutes)} expected`}
            >
              <UtilizationBar logged={loggedMinutes} capacity={expectedMinutes} />
            </Stat>
            <Stat
              label="Billable"
              value={formatTotalHours(billableMinutes)}
              share={formatShare(billableMinutes, loggedMinutes)}
              note={`${formatTotalHours(loggedMinutes - billableMinutes)} non-billable`}
            >
              <BillableBar
                billable={billableMinutes}
                nonBillable={loggedMinutes - billableMinutes}
                capacity={loggedMinutes}
              />
            </Stat>
          </StatList>
        )}
        <ColorMode
          palette={missingCount === 0 ? "green" : "yellow"}
          class="stack-h items-center gap-m b-all bc-default br-l py-xs px-m ink-default surface-tinted"
        >
          <span class="stack-v gap-4xs">
            <span class="fs-m">
              {formatDate(month, "month")} is <strong>{lockStatus}</strong>
            </span>
            <span class="fs-s ink-subtle">
              {activeLock
                ? `Locked by ${activeLock.lockedByName}, ${formatDate(isoDateInOslo(activeLock.lockedAt))}`
                : missingCount === 0
                  ? isDueForLock
                    ? "All consultants have logged their hours!"
                    : "Everyone is up to date so far."
                  : `Still lacks hours from ${missingCount} ${missingCount === 1 ? "consultant" : "consultants"}.`}
            </span>
          </span>
          {canChangeLock &&
            (activeLock ? (
              <UnlockMonthForm organizationSlug={organizationSlug} month={month} />
            ) : (
              <LockMonthForm organizationSlug={organizationSlug} month={month} />
            ))}
        </ColorMode>
      </div>
      {rows.length > 0 && (
        <DataGrid
          columns={[
            { kind: "fit" },
            { label: "Consultant" },
            { label: "Logged", kind: "number" },
            { label: "Billable share", kind: "number" },
            { label: "Expected", kind: "number" },
            { label: "Missing", kind: "number" },
          ]}
        >
          <ConsultantGroup
            palette="coral"
            icon="thumb_down"
            title="Still missing hours"
            month={month}
            canOpenConsultants={canOpenConsultants}
            rows={rows
              .filter((row) => row.missingMinutes > 0)
              .sort((a, b) => b.missingMinutes - a.missingMinutes)}
          />
          <ConsultantGroup
            palette="green"
            icon="thumb_up"
            title="All hours logged"
            month={month}
            canOpenConsultants={canOpenConsultants}
            rows={rows.filter((row) => row.missingMinutes === 0)}
          />
        </DataGrid>
      )}
    </Page>
  );
}

function ConsultantGroup({
  palette,
  icon,
  title,
  rows,
  month,
  canOpenConsultants,
}: {
  palette: Palette;
  icon: IconName;
  title: string;
  rows: ConsultantRow[];
  month: string;
  canOpenConsultants: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <DataGrid.Group
        icon={
          <ColorMode palette={palette} class="ink-default">
            <Icon name={icon} />
          </ColorMode>
        }
      >
        {title}
      </DataGrid.Group>
      {rows.map((row) => (
        <DataGrid.Row href={canOpenConsultants ? consultantPath(row.id, month) : undefined}>
          {""}
          <DataGrid.Title>{row.name}</DataGrid.Title>
          <span class="stack-h nowrap items-center justify-end gap-xs">
            {formatTotalHours(row.minutes)}
            <span style="width: 6em;">
              <UtilizationBar logged={row.minutes} capacity={row.expectedMinutes} />
            </span>
          </span>
          {formatShare(row.billableMinutes, row.minutes)}
          <span class="ink-subtle">{formatTotalHours(row.expectedMinutes)}</span>
          {row.missingMinutes > 0 ? formatTotalHours(row.missingMinutes) : ""}
        </DataGrid.Row>
      ))}
    </>
  );
}
