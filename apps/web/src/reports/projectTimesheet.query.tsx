import { type Calendar, calendarFor } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import { daysOfMonth, isIsoMonth } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import { clients, projects, timeEntriesExport } from "@tid/db/schema";
import { formatHours, formatTotalHours } from "@tid/elements/hours";
import { and, between, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { css } from "hono/css";
import { formatAmount } from "../amount/amount";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";
import { renderForPrint } from "../printLayout";
import { VariantSymbol, VariantWordmark } from "../variantLogo";
import { reportQuery } from "./period";
import { reportPath } from "./reportsUrl";

export const projectTimesheet = async (
  c: Context<UserEnv, "/:organization/projects/:code/:month">,
) => {
  const month = c.req.param("month");
  if (!isIsoMonth(month)) return c.notFound();
  const organization = await findOrganizationBySlug(c.req.param("organization"));
  if (!organization) return c.notFound();
  const [project] = await database
    .select({
      code: projects.code,
      name: projects.name,
      billing: projects.billing,
      client: clients.name,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.code, c.req.param("code")));
  if (!project) return c.notFound();

  const days = daysOfMonth(month);
  const view = timeEntriesExport;
  const entries = await database
    .select({
      email: view.userEmail,
      name: view.userName,
      day: view.spentDate,
      hours: sql`sum(${view.hours})`.mapWith(Number),
      amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
    })
    .from(view)
    .where(
      and(
        // Each organization invoices the work of its own consultants.
        eq(view.accountName, organization.legalName),
        eq(view.projectCode, project.code),
        between(view.spentDate, days[0] ?? "", days.at(-1) ?? ""),
      ),
    )
    .groupBy(view.userEmail, view.userName, view.spentDate)
    .orderBy(view.userName);

  const consultants = new Map<string, Consultant>();
  for (const entry of entries) {
    const consultant = consultants.get(entry.email) ?? {
      name: entry.name,
      hoursByDay: new Map(),
      hours: 0,
    };
    consultant.hoursByDay.set(entry.day, entry.hours);
    consultant.hours += entry.hours;
    consultants.set(entry.email, consultant);
  }

  const period = formatDate(month, "month");
  return renderForPrint(
    c,
    { title: `Timesheet details – ${project.client} – ${period}`, style: timesheetDetailsStyle },
    <TimesheetDetails
      client={project.client}
      projectName={project.name}
      period={period}
      days={days}
      calendar={calendarFor(organization.country)}
      consultants={[...consultants.values()]}
      // Fixed fee and non-billable projects have no amount to show.
      amount={
        project.billing === "hourly"
          ? formatAmount(
              entries.reduce((total, entry) => total + entry.amount, 0),
              organization.currency,
              2,
            )
          : undefined
      }
      reportHref={reportPath(
        c.req.param("organization"),
        reportQuery(`${month}-01`, "projects", todayInOslo()),
      )}
    />,
  );
};

type Consultant = { name: string; hoursByDay: Map<string, number>; hours: number };

// Sized in points, like the paper it's printed on. The page margins live in the padding, so the
// browser has no room left to print its own header and footer.
const timesheetDetailsStyle = css`
  @page { margin: 0; }
  .timesheet-details { font-size: 10pt; font-variant-numeric: lining-nums tabular-nums; }
  @media print { .timesheet-details { padding: 36pt 28pt 72pt; } }
  .timesheet-details header { display: flex; justify-content: space-between; align-items: start; }
  .timesheet-details h1 { font-size: 40pt; font-weight: 600; line-height: 1; letter-spacing: -0.02em; margin-bottom: 48pt; }
  .timesheet-details dl { display: grid; grid-template-columns: auto 1fr; gap: 2pt 8pt; line-height: 1.25; margin-bottom: 24pt; }
  .timesheet-details dd { font-weight: 600; }

  .timesheet-details table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 7pt; }
  .timesheet-details th, .timesheet-details td { padding: 6pt 4pt 4pt 2pt; text-align: right; vertical-align: bottom; white-space: nowrap; }
  .timesheet-details th { font-weight: 600; background: #f4f4f4; }
  .timesheet-details th:first-child { border-radius: 4pt 0 0 4pt; }
  .timesheet-details th:last-child { border-radius: 0 4pt 4pt 0; }
  .timesheet-details td { border-bottom: 1px solid #cdcdcd; }
  .timesheet-details th + th, .timesheet-details td + td { border-left: 1px solid #cdcdcd; }
  .timesheet-details th:first-child, .timesheet-details td:first-child { text-align: left; padding-left: 4pt; }
  .timesheet-details .day { width: 22pt; }
  .timesheet-details .day-off { color: #fe6d6d; }
  .timesheet-details .sum, .timesheet-details tfoot { font-weight: 600; }

  .timesheet-details .amount { display: flex; justify-content: flex-end; gap: 8pt; margin-top: 24pt; }
  .timesheet-details .amount strong { font-weight: 600; }

  .timesheet-details footer { display: flex; justify-content: space-between; align-items: center; margin-top: 48pt; font-size: 7pt; }
  /* Fixed elements repeat on every printed page. */
  @media print { .timesheet-details footer { position: fixed; left: 28pt; right: 28pt; bottom: 24pt; } }
`;

function TimesheetDetails({
  client,
  projectName,
  period,
  days,
  calendar,
  consultants,
  amount,
  reportHref,
}: {
  client: string;
  projectName: string;
  period: string;
  days: string[];
  calendar: Calendar;
  consultants: Consultant[];
  amount: string | undefined;
  reportHref: string;
}) {
  const hoursOn = (day: string) =>
    consultants.reduce((total, consultant) => total + (consultant.hoursByDay.get(day) ?? 0), 0);
  const totalHours = consultants.reduce((total, consultant) => total + consultant.hours, 0);
  // A dash shows the day was looked at, where a blank could look like a missing value.
  const dayCell = (hours: number) => <td>{formatHours(Math.round(hours * 60)) || "-"}</td>;

  return (
    <main class="timesheet-details">
      <p class="screen-only mb-l">
        <a href={reportHref}>← Reports</a> · Print or save as PDF from the browser's print dialog.
      </p>
      <header>
        <h1>Timesheet details</h1>
        <VariantSymbol />
      </header>
      <dl>
        <dt>Customer</dt>
        <dd>{client}</dd>
        <dt>Project</dt>
        <dd>{projectName}</dd>
        <dt>Period</dt>
        <dd>{period}</dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {days.map((day) => (
              <th class={calendar.isWorkday(day) ? "day" : "day day-off"}>
                {Number(day.slice(8))}
              </th>
            ))}
            <th>Sum</th>
          </tr>
        </thead>
        <tbody>
          {consultants.map((consultant) => (
            <tr>
              <td>{consultant.name}</td>
              {days.map((day) => dayCell(consultant.hoursByDay.get(day) ?? 0))}
              <td class="sum">{formatTotalHours(consultant.hours * 60)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Sum</td>
            {days.map((day) => dayCell(hoursOn(day)))}
            <td>{formatTotalHours(totalHours * 60)}</td>
          </tr>
        </tfoot>
      </table>
      {amount && (
        <p class="amount">
          Total amount <strong>{amount}</strong>
        </p>
      )}
      <footer>
        <span>
          Timesheet details · {client} · {period}
        </span>
        <VariantWordmark />
      </footer>
    </main>
  );
}
