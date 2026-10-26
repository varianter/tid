import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths, firstDayOfMonth, monthOf } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import {
  assignmentRates,
  clients,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  users,
} from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { Badge, Button, DataGrid, Detail, Icon, Page, Section, Stat, StatList } from "@tid/ui";
import { and, desc, eq, lte, type SQL, sql } from "drizzle-orm";
import type { Context } from "hono";
import { formatAmount } from "../amount/amount";
import { consultantPath } from "../consultants/consultantsUrl";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { managesProject } from "../managers/manager";
import {
  type AssignmentState,
  assignmentState,
  projectConsultantsPath,
  projectRatesPath,
  stateOrder,
} from "../projectConsultants/projectConsultant";
import { billingLabels } from "./billing";
import { type ProjectSummary, projectSummary } from "./projectSummary";
import { projectReportUrl } from "./projectsUrl";

type HoursSpent = { total: number; lastMonth: number; thisMonth: number };

// Minutes in each period, summed over the time entries that `where` keeps.
const hoursSpent = (today: string) => {
  const thisMonthStart = firstDayOfMonth(monthOf(today));
  const lastMonthStart = firstDayOfMonth(addMonths(monthOf(today), -1));
  const minutesFrom = (condition?: SQL) =>
    sql`coalesce(sum(${timeEntries.minutes}) ${condition ? sql`filter (where ${condition})` : sql``}, 0)`.mapWith(
      Number,
    );
  return {
    total: minutesFrom(),
    lastMonth: minutesFrom(
      sql`${timeEntries.spentOn} >= ${lastMonthStart} and ${timeEntries.spentOn} < ${thisMonthStart}`,
    ),
    thisMonth: minutesFrom(sql`${timeEntries.spentOn} >= ${thisMonthStart}`),
  };
};

export const projectDetails = async (c: Context<UserEnv>) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id)) return c.notFound();
  const [project] = await database
    .select(projectSummary)
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.id, id));
  if (!project) return c.notFound();

  const today = todayInOslo();
  const [projectHours] = await database
    .select(hoursSpent(today))
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(eq(tasks.projectId, id));

  const projectTasks = await database
    .select({
      name: tasks.name,
      spentMinutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
    })
    .from(tasks)
    .leftJoin(timeEntries, eq(timeEntries.taskId, tasks.id))
    .where(eq(tasks.projectId, id))
    .groupBy(tasks.id)
    .orderBy(tasks.name);

  const currentRate = (column: typeof assignmentRates.rate) =>
    sql<number | null>`(
      select ${column} from ${assignmentRates}
      where ${and(
        eq(assignmentRates.projectId, id),
        eq(assignmentRates.userId, users.id),
        lte(assignmentRates.validFrom, today),
      )}
      order by ${assignmentRates.validFrom} desc limit 1
    )`;
  const assignedPeople = await database
    .select({
      id: users.id,
      name: users.name,
      rate: currentRate(assignmentRates.rate),
      endsOn: projectAssignments.endsOn,
      leftOn: users.endsOn,
      ...hoursSpent(today),
    })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .leftJoin(tasks, eq(tasks.projectId, projectAssignments.projectId))
    .leftJoin(timeEntries, and(eq(timeEntries.taskId, tasks.id), eq(timeEntries.userId, users.id)))
    .where(eq(projectAssignments.projectId, id))
    .groupBy(users.id, projectAssignments.endsOn)
    .orderBy(users.name);

  const participations = await database
    .select({
      name: organizations.name,
      isContractOwner: projectOrganizations.isContractOwner,
      openToMembers: projectOrganizations.openToMembers,
    })
    .from(projectOrganizations)
    .innerJoin(organizations, eq(organizations.id, projectOrganizations.orgId))
    .where(eq(projectOrganizations.projectId, id))
    .orderBy(desc(projectOrganizations.isContractOwner), organizations.name);

  const user = c.get("user");
  const canManageProject = await managesProject(user, id);

  return c.render(
    <ProjectDetailsPage
      project={project}
      hours={projectHours ?? { total: 0, lastMonth: 0, thisMonth: 0 }}
      tasks={projectTasks}
      assignedPeople={assignedPeople
        .map((person) => ({ ...person, state: assignmentState(person, today) }))
        .toSorted((a, b) => stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state))}
      participations={participations}
      canManageProject={canManageProject}
      canAssign={user.isManager}
      canOpenConsultants={user.isManager}
    />,
  );
};

// A badge per state; only an ongoing assignment without an end date goes without one.
function stateBadge({ endsOn, state }: Pick<Consultant, "endsOn" | "state">) {
  if (state === "leftCompany") return <Badge class="mt-3xs d-inline-block">Has left Variant</Badge>;
  if (!endsOn) return undefined;
  const verb = state === "offProject" ? "Left project" : "Last day on the project";
  return (
    <Badge class="mt-3xs d-inline-block">
      {verb} {formatDate(endsOn, "numeric")}
    </Badge>
  );
}

type TaskTotal = { name: string; spentMinutes: number };

type Person = { id: number; name: string };

type Consultant = Person &
  HoursSpent & {
    /** In minor units of the project's currency; none when no rate has started yet. */
    rate: number | null;
    endsOn: string | null;
    /** The day they left the company. */
    leftOn: string | null;
    state: AssignmentState;
  };

type Participation = {
  name: string;
  isContractOwner: boolean;
  openToMembers: boolean;
};

type ProjectDetailsPageProps = {
  project: ProjectSummary;
  hours: HoursSpent;
  tasks: TaskTotal[];
  /** On the project first, then those who rolled off, then those who left the company. */
  assignedPeople: Consultant[];
  /** The contract owner first, so it reads as the lead organization. */
  participations: Participation[];
  /** Edit the project, its tasks, consultants and rates. */
  canManageProject: boolean;
  /** Any manager may assign their own organization's consultants. */
  canAssign: boolean;
  /** Only managers may open a consultant's page. */
  canOpenConsultants: boolean;
};

function ProjectDetailsPage({
  project,
  hours,
  tasks,
  assignedPeople,
  participations,
  canManageProject,
  canAssign,
  canOpenConsultants,
}: ProjectDetailsPageProps) {
  const isHourly = project.billing === "hourly";
  const contractOwner = participations.find((participation) => participation.isContractOwner);
  return (
    <Page
      title={project.name}
      description={
        <>
          <a href={`/clients/${project.clientId}`}>{project.client}</a>
          <Badge>{project.code}</Badge>
        </>
      }
      back={{ href: "/projects", label: "Back to projects" }}
      actions={
        <>
          <Button
            as="a"
            href={projectReportUrl.path({ projectId: project.id, month: monthOf(todayInOslo()) })}
            data-variant="tinted"
          >
            <Icon name="bar_chart" />
            Report
          </Button>
          {canManageProject && isHourly && (
            <Button as="a" href={projectRatesPath(project.id)} data-variant="outlined">
              Rates
            </Button>
          )}
          {canManageProject && (
            <Button as="a" href={`/projects/${project.id}/edit`} data-variant="outlined">
              <Icon name="settings" />
              Edit
            </Button>
          )}
        </>
      }
    >
      <dl class="stack-h items-start gap-xl gap-row-s b-all bc-default br-l p-m self-start">
        <Detail label="Billing">
          {[billingLabels[project.billing], project.currency].filter(Boolean).join(" · ")}
        </Detail>
        <Detail label="Contract owner">{contractOwner?.name ?? "None"}</Detail>
        <Detail label="Organizations">
          {participations.length === 0 ? (
            "None"
          ) : (
            <span class="stack-h wrap items-center gap-xs">
              {participations.map((participation) => (
                <Badge
                  title={
                    participation.openToMembers
                      ? "Everyone in the organization may log hours here"
                      : undefined
                  }
                >
                  {participation.name}
                  {participation.openToMembers && " · Open"}
                </Badge>
              ))}
            </span>
          )}
        </Detail>
      </dl>
      <StatList>
        <Stat label="Total hours" value={formatTotalHours(hours.total)} />
        <Stat label="Last month" value={formatTotalHours(hours.lastMonth)} />
        <Stat label="This month so far" value={formatTotalHours(hours.thisMonth)} />
      </StatList>
      <Section
        title="Consultants"
        actions={
          canAssign && (
            <Button as="a" href={`${projectConsultantsPath(project.id)}/new`}>
              Assign
            </Button>
          )
        }
      >
        {assignedPeople.length === 0 ? (
          <p class="ink-subtle">No one is assigned yet.</p>
        ) : (
          <DataGrid
            columns={[
              { label: "Name" },
              { label: "Total", kind: "number" },
              { label: "Last month", kind: "number" },
              { label: "This month", kind: "number" },
              isHourly && { label: "Rate", kind: "number" },
              canManageProject && { kind: "action" },
            ]}
          >
            {assignedPeople.map((person) => (
              <DataGrid.Row
                href={
                  canOpenConsultants && !canManageProject ? consultantPath(person.id) : undefined
                }
              >
                <DataGrid.Title secondary={stateBadge(person)}>
                  {canOpenConsultants && canManageProject ? (
                    <a href={consultantPath(person.id)}>{person.name}</a>
                  ) : (
                    person.name
                  )}
                </DataGrid.Title>
                {formatTotalHours(person.total)}
                {formatTotalHours(person.lastMonth)}
                {formatTotalHours(person.thisMonth)}
                {isHourly &&
                  (person.rate === null || project.currency === null
                    ? "–"
                    : `${formatAmount(person.rate / 100, project.currency, 2)}/h`)}
                {canManageProject &&
                  (person.state === "onProject" ? (
                    <Button
                      as="a"
                      href={`${projectConsultantsPath(project.id)}/${person.id}/end`}
                      class="aspect-square p-0"
                      data-variant="plain"
                      data-size="small"
                      aria-label={`End ${person.name}'s assignment`}
                    >
                      <Icon name="close" />
                    </Button>
                  ) : (
                    ""
                  ))}
              </DataGrid.Row>
            ))}
          </DataGrid>
        )}
      </Section>
      <Section
        title="Tasks"
        actions={
          canManageProject && (
            <Button as="a" href={`/projects/${project.id}/tasks/new`}>
              Add task
            </Button>
          )
        }
      >
        {tasks.length === 0 ? (
          <p class="ink-subtle">No tasks yet.</p>
        ) : (
          <DataGrid columns={[{ label: "Name" }, { label: "Spent", kind: "number" }]}>
            {tasks.map((task) => (
              <DataGrid.Row>
                <DataGrid.Title>{task.name}</DataGrid.Title>
                {formatTotalHours(task.spentMinutes)}
              </DataGrid.Row>
            ))}
          </DataGrid>
        )}
      </Section>
    </Page>
  );
}
