import { formatDate } from "@tid/calendar/dateDisplay";
import { firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { organizations, projects, timeEntriesExport, users } from "@tid/db/schema";
import {
  BarChart,
  ColorMode,
  DataGrid,
  EmptyState,
  Page,
  PeriodNavigation,
  Stat,
  StatList,
  Tabs,
} from "@tid/ui";
import { between, eq, sql } from "drizzle-orm";
import { formatAmounts } from "../amount/amount";
import { BillableBar } from "../billable/billableBar";
import { database } from "../database";
import { type QueryProps, queryPage } from "../query/queryPage";
import { UtilizationBar } from "../reports/utilizationBar";
import { formatShare } from "../share/share";
import { isYear, monthsOf, type Period, shiftPeriod, togglePeriod } from "./applesaucePeriod";
import { applesauceUrl } from "./applesauceUrl";
import {
  amountPerConsultant,
  averageRates,
  billablePercentByMonth,
  type LoggedTime,
  type OfficeTotals,
  summarizeOffices,
  totalOfOffices,
} from "./officeSummary";

type Office = typeof organizations.$inferSelect;

async function loadLoggedTime(period: Period): Promise<LoggedTime[]> {
  const months = monthsOf(period, thisMonthInOslo());
  const first = months[0];
  const last = months.at(-1);
  if (!first || !last) return [];
  const view = timeEntriesExport;
  const month = sql<string>`to_char(${view.spentDate}, 'YYYY-MM')`;
  return database
    .select({
      office: view.accountName,
      userId: users.id,
      endsOn: users.endsOn,
      month,
      currency: projects.currency,
      hours: sql`sum(${view.hours})`.mapWith(Number),
      billableHours: sql`sum(${view.billableHours})`.mapWith(Number),
      billableBaseHours: sql`sum(${view.billableBaseHours})`.mapWith(Number),
      amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
      ratedHours:
        sql`coalesce(sum(${view.billableHours}) filter (where ${view.amount} is not null), 0)`.mapWith(
          Number,
        ),
    })
    .from(view)
    .innerJoin(projects, eq(projects.code, view.projectCode))
    .innerJoin(users, eq(users.email, view.userEmail))
    .where(between(view.spentDate, firstDayOfMonth(first), lastDayOfMonth(last)))
    .groupBy(view.accountName, users.id, users.endsOn, month, projects.currency);
}

export const applesauce = queryPage({
  url: applesauceUrl,
  loader: async (_c, { period }) => {
    const offices = await database
      .select()
      .from(organizations)
      .orderBy(organizations.country, organizations.name);
    const [logged, previouslyLogged] = await Promise.all([
      loadLoggedTime(period),
      loadLoggedTime(shiftPeriod(period, -1)),
    ]);
    const current = summarizeOffices(offices, logged);
    const previous = summarizeOffices(offices, previouslyLogged);
    return {
      billableByMonth: billablePercentByMonth(logged),
      offices: offices.map((office) => ({
        office,
        totals: current.get(office.legalName) as OfficeTotals,
      })),
      total: totalOfOffices([...current.values()]),
      previousTotal: totalOfOffices([...previous.values()]),
    };
  },
  view: ApplesaucePage,
});

const formatPeriod = (period: Period) => (isYear(period) ? period : formatDate(period, "month"));

function ApplesaucePage({
  billableByMonth,
  offices,
  total,
  previousTotal,
  query,
  href,
}: {
  billableByMonth: Map<string, number>;
  offices: { office: Office; totals: OfficeTotals }[];
  total: ReturnType<typeof totalOfOffices>;
  previousTotal: ReturnType<typeof totalOfOffices>;
} & QueryProps<typeof applesauceUrl>) {
  const { period } = query;
  const unit = isYear(period) ? "year" : "month";
  const previous = formatPeriod(shiftPeriod(period, -1));
  const toggled = togglePeriod(period, thisMonthInOslo());
  return (
    <Page
      title="Applesauce"
      actions={
        <>
          <Tabs aria-label="Period">
            <Tabs.Link
              href={href({ period: isYear(period) ? toggled : period })}
              active={!isYear(period)}
            >
              Month
            </Tabs.Link>
            <Tabs.Link
              href={href({ period: isYear(period) ? period : toggled })}
              active={isYear(period)}
            >
              Year
            </Tabs.Link>
          </Tabs>
          <PeriodNavigation
            previousHref={href({ period: shiftPeriod(period, -1) })}
            nextHref={href({ period: shiftPeriod(period, 1) })}
            previousLabel={`Previous ${unit}`}
            nextLabel={`Next ${unit}`}
          >
            {formatPeriod(period)}
          </PeriodNavigation>
        </>
      }
    >
      <StatList>
        <Stat
          label="Billable"
          value={formatShare(total.billableHours, total.billableBaseHours)}
          note={`${formatShare(previousTotal.billableHours, previousTotal.billableBaseHours) || "Nothing"} in ${previous}`}
        >
          <BillableBar
            billable={total.billableHours}
            nonBillable={total.billableBaseHours - total.billableHours}
            capacity={total.billableBaseHours}
          />
        </Stat>
        <Stat
          label="Utilization"
          value={formatShare(total.hours, total.capacityHours)}
          note={`${formatShare(previousTotal.hours, previousTotal.capacityHours) || "Nothing"} in ${previous}`}
        >
          <UtilizationBar logged={total.hours} capacity={total.capacityHours} />
        </Stat>
        <Stat
          label="Consultants"
          value={String(total.consultants)}
          note={`${previousTotal.consultants} in ${previous}`}
        />
      </StatList>
      {isYear(period) && (
        <ColorMode palette="blue" class="d-block b-all bc-subtle br-l p-m">
          <BarChart
            aria-label="Billable per month"
            max={100}
            track
            // Every month of the year, so months to come show as empty columns.
            points={monthsOf(period, `${period}-12`).map((month) => ({
              label: month,
              value: billableByMonth.get(month) ?? 0,
            }))}
          />
        </ColorMode>
      )}
      <div class="b-all bc-subtle br-l p-m">
        {total.hours === 0 ? (
          <EmptyState emoji="🍎" title="No hours logged">
            No time was logged in {formatPeriod(period)}.
          </EmptyState>
        ) : (
          <DataGrid
            columns={[
              { label: "Office" },
              { label: "Billable", kind: "number" },
              { label: "Utilization", kind: "number" },
              { label: "Consultants", kind: "number" },
              { label: "Billable amount", kind: "number" },
              { label: "Average rate", kind: "number" },
              { label: "Per consultant", kind: "number" },
            ]}
          >
            {offices
              .filter(({ totals }) => totals.hours > 0)
              .map(({ office, totals }) => (
                <DataGrid.Row>
                  <DataGrid.Title>{office.name}</DataGrid.Title>
                  {formatShare(totals.billableHours, totals.billableBaseHours)}
                  {formatShare(totals.hours, totals.capacityHours)}
                  {totals.consultants}
                  {formatAmounts(totals.amounts, office.currency)}
                  {formatAmounts(averageRates(totals), office.currency)}
                  {formatAmounts(amountPerConsultant(totals), office.currency)}
                </DataGrid.Row>
              ))}
            <DataGrid.Footer>
              {[
                "Total",
                formatShare(total.billableHours, total.billableBaseHours),
                formatShare(total.hours, total.capacityHours),
                total.consultants,
                "",
                "",
                "",
              ]}
            </DataGrid.Footer>
          </DataGrid>
        )}
      </div>
    </Page>
  );
}
