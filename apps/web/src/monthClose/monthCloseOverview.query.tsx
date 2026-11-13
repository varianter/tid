import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths } from "@tid/calendar/isoDate";
import type { Country } from "@tid/calendar/publicHolidays";
import { organizations } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { Badge, DataGrid, Icon, Page, PeriodNavigation } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import type { Context } from "hono";
import { formatAmount, sumAmounts } from "../domain/amount/amount";
import { countryVisibility } from "../domain/managers/manager";
import { countryNames } from "../domain/organizations/country";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { Filtered } from "../framework/filter";
import { yearsAround } from "../framework/periodNavigation";
import { type QueryProps, queryPage } from "../framework/queryPage";
import { sumBillableHours } from "../invoiceData/invoicedHours";
import { FixedPriceCheckbox } from "../projects/fixedPriceFilter";
import { reportUrl } from "../reports/reports.url";
import { type BilledProject, loadBilledProjects } from "./billedProjects.data";
import { loadConsultantHours } from "./consultantHours.data";
import { consultantHoursUrl, monthCloseOverviewUrl } from "./monthClose.url";
import { MonthCloseTabs } from "./monthCloseTabs";
import { findActiveLock, findMonthBeingClosed } from "./monthLock.data";

type OrganizationToClose = {
  name: string;
  country: Country;
  currency: string;
  /** Where its consultants' hours are, for a user who may see its country. */
  consultantsHref: string | undefined;
  /** Where its consultants' billable hours are broken down by project, for the same user. */
  reportHref: string | undefined;
  monthCloseLocked: boolean;
  /** Consultants whose logged hours fall short of what the month expects of them. */
  consultantsMissingHours: number;
  projects: BilledProject[];
};

/** Every organization with its month close status and the projects its consultants billed. */
async function loadOrganizationsToClose(
  c: Context<UserEnv>,
  { month, fixedPrice }: { month: string; fixedPrice?: boolean },
): Promise<OrganizationToClose[]> {
  const canViewCountry = countryVisibility(c.get("user"));
  const [allOrganizations, projects] = await Promise.all([
    database.select().from(organizations).orderBy(organizations.country, organizations.name),
    loadBilledProjects(month, fixedPrice === true),
  ]);
  return Promise.all(
    allOrganizations.map(async (organization): Promise<OrganizationToClose> => {
      const [lock, consultants] = await Promise.all([
        findActiveLock(organization.id, month),
        loadConsultantHours(organization, month),
      ]);
      const canView = canViewCountry(organization.country);
      return {
        name: organization.name,
        country: organization.country,
        currency: organization.currency,
        consultantsHref: canView
          ? consultantHoursUrl.path({ month, organization: organization.slug })
          : undefined,
        // Only billable hours, so the report adds up to the row it opens from.
        reportHref: canView
          ? reportUrl.path({
              organization: organization.slug,
              month,
              tab: "overview",
              billable: true,
              fixedPrice,
            })
          : undefined,
        monthCloseLocked: lock !== undefined,
        consultantsMissingHours: consultants.filter((consultant) => consultant.missingMinutes > 0)
          .length,
        projects: projects.filter((project) => project.organizationId === organization.id),
      };
    }),
  );
}

/**
 * The total in the organization's currency, with any other currency some projects bill in on a
 * smaller line below.
 */
function Total({
  projects,
  currency,
  class: className,
}: {
  projects: BilledProject[];
  currency: string;
  class: string;
}) {
  const amounts = sumAmounts(projects);
  const amount = amounts[currency] ?? 0;
  const otherAmounts = Object.entries(amounts)
    .filter(([other, otherAmount]) => other !== currency && otherAmount !== 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([other, otherAmount]) => `+ ${formatAmount(otherAmount, other, "withCurrency")}`);
  return (
    <>
      <data value={amount} class={`d-block ${className}`}>
        {formatAmount(amount, currency, "withCurrency")}
      </data>
      {otherAmounts.length > 0 && (
        <small class="d-block fs-xs ink-subtle">{otherAmounts.join(", ")}</small>
      )}
    </>
  );
}

export const monthCloseOverviewRedirect = async (c: Context<UserEnv>) => {
  const month = await findMonthBeingClosed(c.get("user").organization.id);
  return c.redirect(monthCloseOverviewUrl.path({ month }));
};

export const monthCloseOverview = queryPage({
  url: monthCloseOverviewUrl,
  loader: async (c: Context<UserEnv>, query) => ({
    organizations: await loadOrganizationsToClose(c, query),
    ownOrganization: c.get("user").organization.slug,
  }),
  view: MonthCloseOverviewPage,
});

/** The biggest invoices first; organizations with nothing to invoice sink to the bottom. */
const byAmount = (left: OrganizationToClose, right: OrganizationToClose) =>
  (sumAmounts(right.projects)[right.currency] ?? 0) -
    (sumAmounts(left.projects)[left.currency] ?? 0) ||
  sumBillableHours(right.projects) - sumBillableHours(left.projects) ||
  left.name.localeCompare(right.name);

function MonthCloseOverviewPage({
  organizations,
  ownOrganization,
  query,
  href,
}: { organizations: OrganizationToClose[]; ownOrganization: string } & QueryProps<
  typeof monthCloseOverviewUrl
>) {
  const { month } = query;
  return (
    <Page
      title="Month close"
      description="Where each organization's month close stands, and what its consultants billed"
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
      <MonthCloseTabs
        active="overview"
        month={month}
        organization={ownOrganization}
        fixedPrice={query.fixedPrice}
      />
      <Filtered by={<FixedPriceCheckbox />}>
        <DataGrid
          columns={[
            { label: "Organization" },
            { label: "Consultants missing hours", kind: "number" },
            { label: "Month close", kind: "fit" },
            { label: "Hours", kind: "number" },
            { label: "Amount", kind: "number" },
          ]}
        >
          {[...Map.groupBy(organizations, (organization) => organization.country)].map(
            ([country, members]) => (
              <CountryRows
                title={countryNames[country]}
                organizations={members.toSorted(byAmount)}
              />
            ),
          )}
        </DataGrid>
      </Filtered>
    </Page>
  );
}

/** A country's organizations and their total, in the one grid every country shares. */
function CountryRows({
  title,
  organizations,
}: {
  title: string;
  organizations: OrganizationToClose[];
}) {
  const projects = organizations.flatMap((organization) => organization.projects);
  const locked = organizations.filter((organization) => organization.monthCloseLocked);
  // A country's organizations share a currency.
  const currency = organizations[0]?.currency ?? "";
  return (
    <>
      <DataGrid.Group>
        <div class="stack-h items-baseline justify-between gap-m wrap">
          <h2 class="fs-xs fw-bold">{title}</h2>
          <p class="fw-regular">
            {locked.length} of {organizations.length} month closes locked
          </p>
        </div>
      </DataGrid.Group>
      {organizations.map((organization) => (
        <OrganizationRow organization={organization} />
      ))}
      <DataGrid.Footer class="mb-m">
        Total
        {""}
        {""}
        <data value={sumBillableHours(projects)}>
          {formatTotalHours(sumBillableHours(projects) * 60)}
        </data>
        <Total projects={projects} currency={currency} class="fw-bold" />
      </DataGrid.Footer>
    </>
  );
}

/** Links to the organization's report for its money, and to its consultants for their hours. */
function OrganizationRow({ organization }: { organization: OrganizationToClose }) {
  const { projects, consultantsHref, reportHref } = organization;
  const hours = sumBillableHours(projects);
  const badge = <MonthCloseBadge locked={organization.monthCloseLocked} />;
  return (
    <DataGrid.Row>
      {reportHref ? (
        <a href={reportHref} class="v-link fs-l" {...{ [attributes.layer]: true }}>
          {organization.name}
        </a>
      ) : (
        <span class="fs-l ink-prominent">{organization.name}</span>
      )}
      <MissingHours consultants={organization.consultantsMissingHours} />
      {consultantsHref ? <a href={consultantsHref}>{badge}</a> : badge}
      {projects.length === 0 ? (
        <span class="ink-subtle">–</span>
      ) : (
        <data value={hours}>{formatTotalHours(hours * 60)}</data>
      )}
      {projects.length === 0 ? (
        <span class="ink-subtle">–</span>
      ) : (
        <Total projects={projects} currency={organization.currency} class="fw-medium" />
      )}
    </DataGrid.Row>
  );
}

/** A locked month close is colored; an open one is the usual state. */
function MonthCloseBadge({ locked }: { locked: boolean }) {
  return locked ? (
    <Badge palette="green" class="stack-h flex-nowrap items-center gap-3xs">
      <Icon name="check" />
      Locked
    </Badge>
  ) : (
    <Badge>Open</Badge>
  );
}

/** How many consultants still owe hours, colored since someone has to chase them. */
function MissingHours({ consultants }: { consultants: number }) {
  if (consultants === 0) return <span class="ink-subtle">–</span>;
  return (
    <Badge palette="coral">
      <data value={consultants}>{consultants}</data>
    </Badge>
  );
}
