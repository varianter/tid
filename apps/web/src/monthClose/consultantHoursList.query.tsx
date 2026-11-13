import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, lastDayOfMonth } from "@tid/calendar/isoDate";
import { isoDateInOslo, todayInOslo } from "@tid/calendar/osloClock";
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
  ProgressBar,
  SidebarLayout,
  Stat,
  StatList,
} from "@tid/ui";
import type { Context } from "hono";
import { consultantPath } from "../consultants/consultants.url";
import { managesOrganization } from "../domain/managers/manager";
import {
  completeOrganization,
  findOrganizationFilter,
  type OrganizationFilter,
  type OrganizationOption,
  OrganizationSelect,
  resolveOrganizationFilter,
} from "../domain/organizations/organizationFilter";
import type { UserEnv } from "../domain/users/user";
import { Filtered } from "../framework/filter";
import { yearsAround } from "../framework/periodNavigation";
import { type QueryProps, queryPage } from "../framework/queryPage";
import { formatShare } from "../share/share";
import { type ConsultantHours, loadConsultantHours } from "./consultantHours.data";
import { LockMonthForm } from "./lockMonth.form";
import { consultantHoursUrl } from "./monthClose.url";
import { MonthCloseTabs } from "./monthCloseTabs";
import { findActiveLock, findMonthBeingClosed } from "./monthLock.data";
import { UnlockMonthForm } from "./unlockMonth.form";

// Months are locked per organization, so a whole country has no month close.
const organizationOf = (option: OrganizationOption) =>
  option.organizations.length === 1 ? option.organizations[0] : undefined;

export const consultantHoursListRedirect = async (c: Context<UserEnv>) => {
  const organizationFilter = await findOrganizationFilter(
    c.get("user"),
    c.req.query("organization"),
  );
  if (!organizationFilter) return c.notFound();
  const organization = organizationOf(organizationFilter.selected);
  if (!organization) return c.notFound();
  const month = await findMonthBeingClosed(organization.id);
  return c.redirect(
    consultantHoursUrl.path({ month, organization: organizationFilter.selected.value }),
  );
};

export const consultantHoursList = queryPage({
  url: consultantHoursUrl,
  complete: completeOrganization,
  loader: async (c: Context<UserEnv>, { month }) => {
    const organizationFilter = await resolveOrganizationFilter(c);
    if (organizationFilter instanceof Response) return organizationFilter;
    const organization = organizationOf(organizationFilter.selected);
    if (!organization) return c.notFound();

    const rows = await loadConsultantHours(organization, month);

    const activeLock = await findActiveLock(organization.id, month);
    const canChangeLock = managesOrganization(c.get("user"), organization.id);
    return {
      organizationFilter: {
        selected: organizationFilter.selected,
        options: organizationFilter.options.filter((option) => organizationOf(option)),
      },
      organizationSlug: organization.slug,
      rows,
      canOpenConsultants: c.get("user").isManager,
      activeLock,
      canChangeLock,
    };
  },
  view: ConsultantHoursListPage,
});

function ConsultantHoursListPage({
  organizationFilter,
  organizationSlug,
  rows,
  canOpenConsultants,
  activeLock,
  canChangeLock,
  query: { month },
  href,
}: {
  organizationFilter: OrganizationFilter;
  organizationSlug: string;
  rows: ConsultantHours[];
  canOpenConsultants: boolean;
  activeLock?: { lockedAt: Date; lockedByName: string };
  canChangeLock: boolean;
} & QueryProps<typeof consultantHoursUrl>) {
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
      description="Whether every consultant has logged their hours"
      period={
        <PeriodNavigation
          previousHref={href({ month: addMonths(month, -1) })}
          nextHref={href({ month: addMonths(month, 1) })}
          previousLabel="Previous month"
          nextLabel="Next month"
          years={yearsAround(month, href)}
        >
          {formatDate(month, "month")}
        </PeriodNavigation>
      }
    >
      <MonthCloseTabs active="consultants" month={month} organization={organizationSlug} />
      <Filtered by={<OrganizationSelect {...organizationFilter} />}>
        <SidebarLayout
          sidebar={
            rows.length === 0 ? (
              <EmptyState title="No consultants yet" />
            ) : (
              <StatList orientation="vertical">
                <Stat
                  label="Logged"
                  value={formatTotalHours(loggedMinutes)}
                  share={formatShare(loggedMinutes, expectedMinutes)}
                  outOf={`${formatTotalHours(expectedMinutes)} expected`}
                >
                  <ProgressBar
                    max={expectedMinutes}
                    segments={[{ value: loggedMinutes, palette: "purple" }]}
                  />
                </Stat>
                <Stat
                  label="Billable"
                  value={formatTotalHours(billableMinutes)}
                  share={formatShare(billableMinutes, loggedMinutes)}
                  note={`${formatTotalHours(loggedMinutes - billableMinutes)} non-billable`}
                >
                  <ProgressBar
                    max={loggedMinutes}
                    segments={[
                      { value: billableMinutes, palette: "blue" },
                      { value: loggedMinutes - billableMinutes, palette: "blue", shade: "soft" },
                    ]}
                  />
                </Stat>
              </StatList>
            )
          }
        >
          <div class="stack-v flex-nowrap gap-s">
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
          </div>
        </SidebarLayout>
      </Filtered>
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
  rows: ConsultantHours[];
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
          <span class="stack-h flex-nowrap items-center justify-end gap-xs">
            {formatTotalHours(row.minutes)}
            <span style="width: 6em;">
              <ProgressBar
                max={row.expectedMinutes}
                segments={[{ value: row.minutes, palette: "purple" }]}
              />
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
