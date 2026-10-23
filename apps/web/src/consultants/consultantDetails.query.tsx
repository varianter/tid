import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, firstDayOfMonth, lastDayOfMonth } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import { clients, organizations, projects, tasks, timeEntries, users } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import {
  Badge,
  DataGrid,
  Page,
  PeriodNavigation,
  ProgressBar,
  Section,
  Stat,
  StatList,
} from "@tid/ui";
import { and, between, desc, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { isManager } from "../managers/manager";
import { type Billing, billingLabels } from "../projects/billing";
import { projectReportUrl } from "../projects/projectsUrl";
import { type QueryProps, queryPage } from "../query/queryPage";
import { capacityMinutes } from "../reports/capacity";
import { formatShare } from "../share/share";
import { MonthEntries, type MonthEntry } from "../timeEntries/monthEntries";
import { consultantsPath, consultantUrl } from "./consultantsUrl";
import { loadCurrentBillableProjects } from "./currentBillableProjects";

export const consultantDetails = queryPage({
  url: consultantUrl,
  loader: async (c: Context<UserEnv>, { userId, month }) => {
    const viewer = c.get("user");
    const viewerIsManager = await isManager(viewer);
    if (viewer.id !== userId && !viewerIsManager) {
      return c.text("Only managers can see other users", 403);
    }
    const [user] = await database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        endsOn: users.endsOn,
        organizationSlug: organizations.slug,
        country: organizations.country,
        fullDayMinutes: organizations.fullDayMinutes,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(eq(users.id, userId));
    if (!user) return c.notFound();

    const currentBillableProjects =
      (await loadCurrentBillableProjects([user.id], todayInOslo())).get(user.id) ?? [];

    const inMonth = and(
      eq(timeEntries.userId, user.id),
      between(timeEntries.spentOn, firstDayOfMonth(month), lastDayOfMonth(month)),
    );
    const [monthTotals] = await database
      .select({
        minutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
        billableMinutes: sql`coalesce(sum(${timeEntries.minutes}) filter (
          where ${projects.billing} <> 'non_billable'
        ), 0)`.mapWith(Number),
      })
      .from(timeEntries)
      .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(inMonth);

    const entries = await database
      .select({
        spentOn: timeEntries.spentOn,
        minutes: timeEntries.minutes,
        notes: timeEntries.notes,
        task: tasks.name,
        title: projects.name,
        subtitle: clients.name,
      })
      .from(timeEntries)
      .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(inMonth)
      .orderBy(desc(timeEntries.spentOn), projects.name, tasks.name);

    return {
      user,
      viewerIsManager,
      currentBillableProjects,
      minutes: monthTotals?.minutes ?? 0,
      billableMinutes: monthTotals?.billableMinutes ?? 0,
      monthCapacityMinutes: capacityMinutes(month, user.country, user.fullDayMinutes, user.endsOn),
      entries,
    };
  },
  view: ConsultantDetailsPage,
});

function ConsultantDetailsPage({
  user,
  viewerIsManager,
  currentBillableProjects,
  minutes,
  billableMinutes,
  monthCapacityMinutes,
  entries,
  query: { month },
  href,
}: {
  user: { name: string; email: string; endsOn: string | null; organizationSlug: string };
  viewerIsManager: boolean;
  currentBillableProjects: CurrentProject[];
  minutes: number;
  billableMinutes: number;
  monthCapacityMinutes: number;
  entries: MonthEntry[];
} & QueryProps<typeof consultantUrl>) {
  return (
    <Page
      title={user.name}
      description={
        <>
          {user.email}
          {user.endsOn && <Badge>Left Variant {formatDate(user.endsOn)}</Badge>}
        </>
      }
      back={
        viewerIsManager
          ? { href: consultantsPath(user.organizationSlug), label: "Consultants" }
          : undefined
      }
      actions={
        <PeriodNavigation
          previousHref={href({ month: addMonths(month, -1) })}
          nextHref={href({ month: addMonths(month, 1) })}
          previousLabel="Previous month"
          nextLabel="Next month"
        >
          {formatDate(month, "month")}
        </PeriodNavigation>
      }
    >
      <div class="stack-h items-start gap-m">
        <div class="stack-v gap-m flex-1">
          <MonthHours
            minutes={minutes}
            billableMinutes={billableMinutes}
            capacityMinutes={monthCapacityMinutes}
          />
          <CurrentProjects
            projects={currentBillableProjects}
            projectHref={(projectId) =>
              projectReportUrl.path({ projectId, month, company: user.organizationSlug })
            }
          />
        </div>
        <MonthEntries month={month} entries={entries} titleLabel="Project" />
      </div>
    </Page>
  );
}

type CurrentProject = { id: number; name: string; client: string; billing: Billing };

function CurrentProjects({
  projects,
  projectHref,
}: {
  projects: CurrentProject[];
  projectHref: (projectId: number) => string;
}) {
  return (
    <Section title="Billable projects">
      {projects.length === 0 ? (
        <p class="ink-subtle">Not assigned to any billable project right now.</p>
      ) : (
        <DataGrid columns={[{ label: "Project" }, { label: "Billing", kind: "fit" }]}>
          {projects.map((project) => (
            <DataGrid.Row href={projectHref(project.id)}>
              <DataGrid.Title secondary={project.client}>{project.name}</DataGrid.Title>
              {billingLabels[project.billing]}
            </DataGrid.Row>
          ))}
        </DataGrid>
      )}
    </Section>
  );
}

function MonthHours({
  minutes,
  billableMinutes,
  capacityMinutes,
}: {
  minutes: number;
  billableMinutes: number;
  capacityMinutes: number;
}) {
  const nonBillableMinutes = minutes - billableMinutes;
  return (
    <StatList>
      <Stat
        label="Logged"
        value={formatTotalHours(minutes)}
        share={formatShare(minutes, capacityMinutes)}
        note={`of ${formatTotalHours(capacityMinutes)} capacity`}
      >
        <ProgressBar max={capacityMinutes} segments={[{ value: minutes, palette: "purple" }]} />
      </Stat>
      <Stat
        label="Billable"
        value={formatTotalHours(billableMinutes)}
        share={formatShare(billableMinutes, minutes)}
        note={`${formatTotalHours(nonBillableMinutes)} non-billable`}
      >
        <ProgressBar
          max={minutes}
          segments={[
            { value: billableMinutes, palette: "blue" },
            { value: nonBillableMinutes, palette: "blue", shade: "soft" },
          ]}
        />
      </Stat>
    </StatList>
  );
}
