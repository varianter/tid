import { formatHours, formatTotalHours } from "@tid/elements/hours";
import type { Context } from "hono";
import { css } from "hono/css";
import type { UserEnv } from "../login/user";
import { resolveCompany } from "../organizations/companyFilter";
import { renderForPrint } from "../printLayout";
import { VariantSymbol, VariantWordmark } from "../variantLogo";
import { loadProjectReport, type ProjectReport } from "./projectReport";
import { projectReportPrintUrl, projectReportUrl } from "./projectsUrl";

export const projectReportPrint = async (c: Context<UserEnv>) => {
  const query = projectReportPrintUrl.read(c.req.url);
  if (!query) return c.notFound();
  const company = await resolveCompany(c);
  if (company instanceof Response) return company;
  const report = await loadProjectReport(query.projectId, query.month, company.selected);
  if (!report) return c.notFound();

  return renderForPrint(
    c,
    {
      title: `Timesheet details – ${report.project.client} – ${report.period}`,
      style: timesheetDetailsStyle,
    },
    <TimesheetDetails
      report={report}
      reportHref={projectReportUrl.path({ ...query, company: company.selected.value })}
    />,
  );
};

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

function TimesheetDetails({ report, reportHref }: { report: ProjectReport; reportHref: string }) {
  const { project, period, amount } = report;
  return (
    <main class="timesheet-details">
      <p class="screen-only mb-l">
        <a href={reportHref}>← Report</a> · Print or save as PDF from the browser's print dialog.
      </p>
      <header>
        <h1>Timesheet details</h1>
        <VariantSymbol />
      </header>
      <dl>
        <dt>Client</dt>
        <dd>{project.client}</dd>
        <dt>Project</dt>
        <dd>{project.name}</dd>
        <dt>Period</dt>
        <dd>{period}</dd>
      </dl>
      <ConsultantDaysTable {...report} />
      {amount && (
        <p class="amount">
          Total amount <strong>{amount}</strong>
        </p>
      )}
      <footer>
        <span>
          Timesheet details · {project.client} · {period}
        </span>
        <VariantWordmark />
      </footer>
    </main>
  );
}

function ConsultantDaysTable({
  days,
  calendar,
  consultants,
  hours,
}: Pick<ProjectReport, "days" | "calendar" | "consultants" | "hours">) {
  const hoursOn = (day: string) =>
    consultants.reduce((total, consultant) => total + (consultant.hoursByDay.get(day) ?? 0), 0);
  // A dash shows the day was looked at, where a blank could look like a missing value.
  const dayCell = (dayHours: number) => <td>{formatHours(Math.round(dayHours * 60)) || "-"}</td>;

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          {days.map((day) => (
            <th class={calendar.isWorkday(day) ? "day" : "day day-off"}>{Number(day.slice(8))}</th>
          ))}
          <th>Total</th>
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
          <td>Total</td>
          {days.map((day) => dayCell(hoursOn(day)))}
          <td>{formatTotalHours(hours * 60)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
