import { organizations, timeEntriesExport } from "@tid/db/schema";
import { and, between, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { database } from "../database";
import { addMonths, daysOfMonth, isWeekend, todayInOslo } from "../dates/dates";
import { reportQuery, type Tab } from "./period";
import { ReportPage, type ReportRows, type Totals } from "./reports.views";

export const reports = new Hono();

// ponytail: everyone lands on Trondheim until we know which organization the user belongs to.
const defaultOrganization = "trondheim";

const reportPath = (organization: string, query: URLSearchParams) =>
  `/reports/${organization}?${query}`;

reports.get("/", (c) =>
  c.redirect(
    reportPath(
      defaultOrganization,
      reportQuery(c.req.query("from"), c.req.query("tab"), todayInOslo()),
    ),
  ),
);

reports.get("/:organization", async (c) => {
  const slug = c.req.param("organization");
  const query = reportQuery(c.req.query("from"), c.req.query("tab"), todayInOslo());
  if (new URL(c.req.url).search !== `?${query}`) return c.redirect(reportPath(slug, query));

  const [organization] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug));
  if (!organization) return c.notFound();

  const from = query.get("from") ?? "";
  const till = query.get("till") ?? "";
  const tab = query.get("tab") as Tab;
  const month = from.slice(0, 7);
  const view = timeEntriesExport;
  const inReport = and(
    // ponytail: the view only exposes the organization's name; add its id if names collide.
    eq(view.accountName, organization.name),
    between(view.spentDate, from, till),
  );

  const totals = {
    hours: sql`sum(${view.hours})`.mapWith(Number),
    billableHours: sql`sum(${view.billableHours})`.mapWith(Number),
    amount: sql`coalesce(sum(${view.amount}), 0)`.mapWith(Number),
    unratedHours:
      sql`coalesce(sum(${view.billableHours}) filter (where ${view.amount} is null), 0)`.mapWith(
        Number,
      ),
  };
  const currency = organization.currency;
  // ponytail: capacity counts every weekday as a full day; subtract holidays and leave once we store them.
  const capacityHours =
    (daysOfMonth(month).filter((day) => !isWeekend(day)).length * organization.fullDayMinutes) / 60;

  const report = await (async (): Promise<ReportRows> => {
    switch (tab) {
      case "clients":
        return {
          tab,
          rows: await database
            .select({ name: view.clientName, ...totals })
            .from(view)
            .where(inReport)
            .groupBy(view.clientName)
            .orderBy(view.clientName),
        };
      case "projects":
        return {
          tab,
          rows: await database
            .select({
              code: view.projectCode,
              name: view.projectName,
              client: view.clientName,
              ...totals,
            })
            .from(view)
            .where(inReport)
            .groupBy(view.projectCode, view.projectName, view.clientName)
            .orderBy(view.projectName),
        };
      case "consultants":
        return {
          tab,
          rows: await database
            .select({ email: view.userEmail, name: view.userName, ...totals })
            .from(view)
            .where(inReport)
            .groupBy(view.userEmail, view.userName)
            .orderBy(view.userName),
        };
      case "tasks":
        return {
          tab,
          rows: await database
            .select({ name: view.taskName, ...totals })
            .from(view)
            .where(inReport)
            .groupBy(view.taskName)
            .orderBy(view.taskName),
        };
    }
  })();

  // Every tab groups the same entries, so its rows add up to the whole report.
  const rows: Totals[] = report.rows;
  const sumOf = (field: keyof Totals) => rows.reduce((total, row) => total + row[field], 0);
  const total: Totals = {
    hours: sumOf("hours"),
    billableHours: sumOf("billableHours"),
    amount: sumOf("amount"),
    unratedHours: sumOf("unratedHours"),
  };
  const monthPath = (months: number) =>
    reportPath(slug, reportQuery(`${addMonths(month, months)}-01`, tab, todayInOslo()));

  return c.render(
    <ReportPage
      month={month}
      report={report}
      total={total}
      currency={currency}
      capacityHours={capacityHours}
      previousHref={monthPath(-1)}
      nextHref={monthPath(1)}
      tabHref={(tabName) => reportPath(slug, reportQuery(from, tabName, todayInOslo()))}
    />,
  );
});
