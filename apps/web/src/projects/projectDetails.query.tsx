import { addMonths } from "@tid/calendar/isoDate";
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
import { Badge, Button, DataGrid, Detail, Page } from "@tid/ui";
import { and, desc, eq, lte, notExists, type SQL, sql } from "drizzle-orm";
import type { Context } from "hono";
import { formatAmount } from "../amount/amount";
import { AssignConsultantForm } from "../assignments/assignConsultant.command";
import { RemoveConsultantForm } from "../assignments/removeConsultant.command";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { isManager } from "../users/manager";
import { AddTaskForm } from "./addTask.command";
import { billingLabels } from "./billing";
import { type ProjectSummary, projectSummary } from "./projectSummary";

type HoursSpent = { total: number; lastMonth: number; thisMonth: number };

// Minutes in each period, summed over the time entries that `where` keeps.
const hoursSpent = (today: string) => {
  const thisMonthStart = `${today.slice(0, 7)}-01`;
  const lastMonthStart = `${addMonths(today.slice(0, 7), -1)}-01`;
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
      currency: organizations.currency,
      rate: currentRate(assignmentRates.rate),
      ...hoursSpent(today),
    })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .leftJoin(tasks, eq(tasks.projectId, projectAssignments.projectId))
    .leftJoin(timeEntries, and(eq(timeEntries.taskId, tasks.id), eq(timeEntries.userId, users.id)))
    .where(eq(projectAssignments.projectId, id))
    .groupBy(users.id, organizations.id)
    .orderBy(users.name);

  const participations = await database
    .select({
      name: organizations.name,
      slug: organizations.slug,
      isContractOwner: projectOrganizations.isContractOwner,
      openToMembers: projectOrganizations.openToMembers,
    })
    .from(projectOrganizations)
    .innerJoin(organizations, eq(organizations.id, projectOrganizations.orgId))
    .where(eq(projectOrganizations.projectId, id))
    .orderBy(desc(projectOrganizations.isContractOwner), organizations.name);

  const assignablePeople = await database
    .select({ id: users.id, name: users.name, orgName: organizations.name })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(
      notExists(
        database
          .select()
          .from(projectAssignments)
          .where(
            and(eq(projectAssignments.projectId, id), eq(projectAssignments.userId, users.id)),
          ),
      ),
    )
    .orderBy(organizations.name, users.name);

  return c.render(
    <ProjectDetailsPage
      project={project}
      hours={projectHours ?? { total: 0, lastMonth: 0, thisMonth: 0 }}
      tasks={projectTasks}
      assignedPeople={assignedPeople}
      assignablePeople={assignablePeople}
      participations={participations}
      isManager={await isManager(c.get("user"))}
    />,
  );
};

type TaskTotal = { name: string; spentMinutes: number };

type Person = { id: number; name: string };

type Consultant = Person &
  HoursSpent & {
    /** In minor units of `currency`; none when no rate has started yet. */
    rate: number | null;
    currency: string;
  };

type Participation = {
  name: string;
  slug: string;
  isContractOwner: boolean;
  openToMembers: boolean;
};

type ProjectDetailsPageProps = {
  project: ProjectSummary;
  hours: HoursSpent;
  tasks: TaskTotal[];
  assignedPeople: Consultant[];
  /** Everyone not assigned yet, sorted by organization so the picker can group them. */
  assignablePeople: (Person & { orgName: string })[];
  /** The contract owner first, so it reads as the lead organization. */
  participations: Participation[];
  isManager: boolean;
};

function ProjectDetailsPage({
  project,
  hours,
  tasks,
  assignedPeople,
  assignablePeople,
  participations,
  isManager,
}: ProjectDetailsPageProps) {
  const isHourly = project.billing === "hourly";
  const contractOwner = participations.find((participation) => participation.isContractOwner);
  return (
    <Page
      title={project.name}
      back={{ href: "/projects", label: "Back to projects" }}
      actions={
        isManager && (
          <Button as="a" href={`/projects/${project.id}/edit`} data-variant="tinted">
            Edit
          </Button>
        )
      }
    >
      <dl class="stack-h items-start gap-xl gap-row-s b-all bc-default br-l p-m">
        <Detail label="Client">
          <a href={`/clients/${project.clientId}`}>{project.client}</a>
        </Detail>
        <Detail label="Code">{project.code}</Detail>
        <Detail label="Billing">{billingLabels[project.billing]}</Detail>
        <Detail label="Contract owner">{contractOwner?.name ?? "None"}</Detail>
        <Detail label="Organizations">
          {participations.length === 0 ? (
            "None"
          ) : (
            // One flex item per organization, so a line never breaks between a name and its badge.
            <span class="stack-h wrap items-center gap-s gap-row-3xs">
              {participations.map((participation, index) => (
                <span>
                  {participation.name}
                  {participation.openToMembers && (
                    <a href={`/organizations/${participation.slug}/projects`}>
                      <Badge class="ml-xs" title="Everyone in the organization may log time here">
                        Open
                      </Badge>
                    </a>
                  )}
                  {index < participations.length - 1 && ","}
                </span>
              ))}
            </span>
          )}
        </Detail>
      </dl>
      <div class="stack-h wrap gap-m">
        <HoursCard label="Total hours" minutes={hours.total} />
        <HoursCard label="Last month" minutes={hours.lastMonth} />
        <HoursCard label="This month so far" minutes={hours.thisMonth} />
      </div>
      <section class="stack-v gap-s">
        <div class="stack-h items-center justify-between gap-m wrap">
          <h2 class="fs-l fw-bold">Consultants</h2>
          {isManager && assignablePeople.length > 0 && (
            <AssignConsultantForm projectId={project.id} assignablePeople={assignablePeople} />
          )}
        </div>
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
              isManager && { kind: "action" },
            ]}
          >
            {assignedPeople.map((person) => (
              <DataGrid.Row>
                <DataGrid.Title>{person.name}</DataGrid.Title>
                {formatTotalHours(person.total)}
                {formatTotalHours(person.lastMonth)}
                {formatTotalHours(person.thisMonth)}
                {isHourly &&
                  (person.rate === null
                    ? "–"
                    : `${formatAmount(person.rate / 100, person.currency, 2)}/h`)}
                {isManager && (
                  <span class="stack-h justify-end gap-xs">
                    {isHourly && (
                      <Button
                        as="a"
                        href={`/projects/${project.id}/assignments/${person.id}/rates`}
                        data-variant="plain"
                        data-size="small"
                      >
                        Edit rate
                      </Button>
                    )}
                    <RemoveConsultantForm projectId={project.id} userId={person.id} />
                  </span>
                )}
              </DataGrid.Row>
            ))}
          </DataGrid>
        )}
      </section>
      <section class="stack-v gap-s">
        <div class="stack-h items-center justify-between gap-m wrap">
          <h2 class="fs-l fw-bold">Tasks</h2>
          {isManager && <AddTaskForm projectId={project.id} />}
        </div>
        {tasks.length === 0 ? (
          <p class="ink-subtle">No tasks yet.</p>
        ) : (
          <ul class="stack-v gap-3xs b-all bc-subtle p-2xs t-tabular">
            {tasks.map((task) => (
              <li class="stack-h justify-between p-xs px-m surface-tinted">
                {task.name}
                <span class="ink-subtle">{formatTotalHours(task.spentMinutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

function HoursCard({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div class="stack-v gap-3xs b-all bc-default br-l p-m">
      <span class="fs-s ink-subtle">{label}</span>
      <span class="fs-xl fw-bold t-tabular">{formatTotalHours(minutes)}</span>
    </div>
  );
}
