import { formatMonth } from "@tid/calendar/dateDisplay";
import { projects, timeEntriesExport } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { DataGrid, Page, PeriodNavigation, Section } from "@tid/ui";
import { and, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { formatAmount } from "../domain/amount/amount";
import { database } from "../framework/database";
import { inMonth } from "../framework/monthCondition";
import { yearsAround } from "../framework/periodNavigation";
import { type QueryProps, queryPage } from "../framework/queryPage";
import { MonthEntries, type MonthEntry } from "../timeEntries/monthEntries";
import { loadProjectEntries } from "./projectReport.data";
import { projectHoursUrl } from "./projects.url";

// Everyone's hours, whichever organization they're in, so a month here matches its row on the
// project's overview.
export const projectHours = queryPage({
  url: projectHoursUrl,
  loader: async (c: Context, { projectId, month }) => {
    const [project] = await database
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        billing: projects.billing,
        currency: projects.currency,
      })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return c.notFound();
    const view = timeEntriesExport;
    const consultants = await database
      .select({
        name: view.userName,
        hours: sql`sum(${view.hours})`.mapWith(Number),
        amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
      })
      .from(view)
      .where(and(eq(view.projectCode, project.code), inMonth(view.spentDate, month)))
      .groupBy(view.userEmail, view.userName)
      .orderBy(view.userName);
    const entries = await loadProjectEntries(projectId, month);
    return { project, consultants, entries };
  },
  view: ProjectHoursPage,
});

type ConsultantHours = {
  name: string;
  hours: number;
  /** In the project's currency. */
  amount: number;
};

function ProjectHoursPage({
  project,
  consultants,
  entries,
  query,
  href,
}: {
  project: { id: number; name: string; billing: string; currency: string | null };
  consultants: ConsultantHours[];
  entries: MonthEntry[];
} & QueryProps<typeof projectHoursUrl>) {
  const period = formatMonth(query.month);
  // Only hourly projects have an amount to show.
  const currency = project.billing === "hourly" ? project.currency : null;
  const sum = (pick: (consultant: ConsultantHours) => number) =>
    consultants.reduce((total, consultant) => total + pick(consultant), 0);
  return (
    <Page
      title={`Hours on ${project.name}`}
      back={{ href: `/projects/${project.id}`, label: `Back to ${project.name}` }}
      period={
        <PeriodNavigation
          previousHref={href({ month: query.month.subtract({ months: 1 }) })}
          nextHref={href({ month: query.month.add({ months: 1 }) })}
          previousLabel="Previous month"
          nextLabel="Next month"
          years={yearsAround(query.month, href)}
        >
          {period}
        </PeriodNavigation>
      }
    >
      <Section title="Consultants">
        {consultants.length === 0 ? (
          <p class="ink-subtle">No one logged time in {period}.</p>
        ) : (
          <DataGrid
            columns={[
              { label: "Name" },
              { label: "Hours", kind: "number" },
              currency !== null && { label: `Amount (${currency})`, kind: "number" },
            ]}
          >
            {consultants.map((consultant) => (
              <DataGrid.Row>
                <DataGrid.Title>{consultant.name}</DataGrid.Title>
                {formatTotalHours(consultant.hours * 60)}
                {currency !== null && formatAmount(consultant.amount, currency, "exact")}
              </DataGrid.Row>
            ))}
            <DataGrid.Footer>
              Total
              {formatTotalHours(sum((consultant) => consultant.hours) * 60)}
              {currency !== null &&
                formatAmount(
                  sum((consultant) => consultant.amount),
                  currency,
                  "exact",
                )}
            </DataGrid.Footer>
          </DataGrid>
        )}
      </Section>
      <MonthEntries month={query.month} entries={entries} titleLabel="Consultant" />
    </Page>
  );
}
