import { formatDate, formatMonth } from "@tid/calendar/dateDisplay";
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
  timeEntriesExport,
  users,
} from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { Badge, Button, DataGrid, Icon, Page, Section, SidebarLayout, SummaryList } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import type { Context } from "hono";
import { consultantPath } from "../consultants/consultants.url";
import { formatAmount } from "../domain/amount/amount";
import { managesProject } from "../domain/managers/manager.data";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import {
  type AssignmentState,
  assignmentState,
  stateOrder,
} from "../projectConsultants/projectConsultant";
import {
  projectConsultantsPath,
  projectRatesPath,
  ratesPath,
} from "../projectConsultants/projectConsultants.url";
import { billingLabels } from "./billing";
import { hasLoggedTime } from "./loggedTime.data";
import { type ProjectSummary, projectSummary } from "./projectSummary";
import { projectHoursUrl } from "./projects.url";

const spentMonth = sql<string>`to_char(${timeEntriesExport.spentDate}, 'YYYY-MM')`;

export const projectDetails = async (c: Context<UserEnv>) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id)) return c.notFound();
  const [project] = await database
    .select({
      ...projectSummary,
      invoicingLead: users.name,
      hasLoggedTime: hasLoggedTime(projects.id),
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(users, eq(users.id, projects.invoicingLeadId))
    .where(eq(projects.id, id));
  if (!project) return c.notFound();

  const today = todayInOslo();
  const projectTasks = await database
    .select({
      id: tasks.id,
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
      lastDay: users.lastDay,
      spentMinutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
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

  const months = await database
    .select({
      month: spentMonth,
      hours: sql`sum(${timeEntriesExport.hours})`.mapWith(Number),
      amount: sql`coalesce(sum(${timeEntriesExport.amount}), 0)`.mapWith(Number),
    })
    .from(timeEntriesExport)
    .where(eq(timeEntriesExport.projectCode, project.code))
    .groupBy(spentMonth)
    .orderBy(desc(spentMonth));

  const user = c.get("user");
  const canManageProject = await managesProject(user, id);

  return c.render(
    <ProjectDetailsPage
      project={project}
      tasks={projectTasks}
      assignedPeople={assignedPeople
        .map((person) => ({ ...person, state: assignmentState(person, today) }))
        .toSorted((a, b) => stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state))}
      participations={participations}
      months={months.map((row) => ({
        ...row,
        month: Temporal.PlainYearMonth.from(row.month),
        href: projectHoursUrl.path({
          projectId: id,
          month: Temporal.PlainYearMonth.from(row.month),
        }),
      }))}
      canManageProject={canManageProject}
      canAssign={user.isManager}
      canOpenConsultants={user.isManager}
    />,
  );
};

const groupTitles: Record<AssignmentState, string> = {
  onProject: "On the project",
  offProject: "Rolled off",
  leftCompany: "Left Variant",
};

// The group already says who has left Variant, so only an assignment's own end gets a badge.
function endBadge({ endsOn, state }: Pick<Consultant, "endsOn" | "state">) {
  if (state === "leftCompany" || !endsOn) return undefined;
  const verb = state === "offProject" ? "Left project" : "Last day on the project";
  return (
    <Badge class="mt-3xs d-inline-block">
      {verb} {formatDate(endsOn, "numeric")}
    </Badge>
  );
}

// Hours logged without a rate have no billable amount, so it's flagged while they can still log.
// Those who manage the project go from the rate to where it's changed.
function rateCell(
  { id, rate, state }: Pick<Consultant, "id" | "rate" | "state">,
  project: { id: number; currency: string | null },
  canManageProject: boolean,
) {
  if (rate !== null && project.currency !== null) {
    const amount = `${formatAmount(rate / 100, project.currency, "exact")}/h`;
    if (!canManageProject) return amount;
    return <a href={projectRatesPath(project.id, id)}>{amount}</a>;
  }
  if (state !== "onProject") return "–";
  const missing = <Badge palette="coral">No rate</Badge>;
  if (!canManageProject) return missing;
  return (
    <a
      href={`${ratesPath({ projectId: project.id, userId: id })}/new`}
      {...{ [attributes.layer]: true }}
    >
      {missing}
    </a>
  );
}

type TaskTotal = { id: number; name: string; spentMinutes: number };

type Person = { id: number; name: string };

type Consultant = Person & {
  spentMinutes: number;
  /** In minor units of the project's currency; none when no rate has started yet. */
  rate: number | null;
  endsOn: Temporal.PlainDate | null;
  /** The day they left the company. */
  lastDay: Temporal.PlainDate | null;
  state: AssignmentState;
};

type MonthHours = {
  month: Temporal.PlainYearMonth;
  hours: number;
  /** In the project's currency. */
  amount: number;
  /** The month's page of hours. */
  href: string;
};

type Participation = {
  name: string;
  isContractOwner: boolean;
  /** Everyone in the organization may log hours on the project, not just those assigned. */
  openToMembers: boolean;
};

const organizationLine = ({ name, openToMembers }: Participation) =>
  openToMembers ? `${name} (open to all)` : name;

type ProjectDetailsPageProps = {
  project: ProjectSummary & { invoicingLead: string | null; hasLoggedTime: boolean };
  tasks: TaskTotal[];
  /** On the project first, then those who rolled off, then those who left the company. */
  assignedPeople: Consultant[];
  /** The contract owner first, so it reads as the lead organization. */
  participations: Participation[];
  /** Newest first, only months with logged time. */
  months: MonthHours[];
  /** Edit the project, its tasks, consultants and rates. */
  canManageProject: boolean;
  /** Any manager may assign their own organization's consultants. */
  canAssign: boolean;
  /** Only managers may open a consultant's page. */
  canOpenConsultants: boolean;
};

function ProjectDetailsPage({
  project,
  tasks,
  assignedPeople,
  participations,
  months,
  canManageProject,
  canAssign,
  canOpenConsultants,
}: ProjectDetailsPageProps) {
  const isHourly = project.billing === "hourly";
  const contractOwner = participations.find((participation) => participation.isContractOwner);
  const participating = participations.filter((participation) => !participation.isContractOwner);
  // Only hourly projects have an amount to show.
  const currency = isHourly ? project.currency : null;
  const groups = Map.groupBy(assignedPeople, (person) => person.state);
  return (
    <Page
      title={project.name}
      description={<a href={`/clients/${project.clientId}`}>{project.client}</a>}
      back={{ href: "/projects", label: "Back to projects" }}
      actions={[
        canManageProject && {
          label: "Edit",
          href: `/projects/${project.id}/edit`,
          icon: "settings",
          [attributes.layer]: true,
        },
        canManageProject &&
          !project.hasLoggedTime && {
            label: "Delete",
            href: `/projects/${project.id}/delete`,
            [attributes.layer]: true,
          },
      ]}
    >
      <SidebarLayout
        sidebar={
          <SummaryList
            rows={[
              { label: "Code", values: [project.code] },
              {
                label: "Billing",
                values: [
                  [billingLabels[project.billing], project.currency].filter(Boolean).join(" · "),
                ],
              },
              { label: "Invoicing lead", values: [project.invoicingLead ?? "None"] },
              {
                label: "Contract owner",
                values: [contractOwner ? organizationLine(contractOwner) : "None"],
              },
              participating.length > 0 && {
                label: "Participating",
                values: participating.map(organizationLine),
              },
            ]}
          />
        }
      >
        <div class="stack-v flex-nowrap gap-xl">
          <Section
            title="Consultants"
            actions={[
              canAssign && {
                label: "Assign",
                href: `${projectConsultantsPath(project.id)}/new`,
                [attributes.layer]: true,
              },
            ]}
          >
            {assignedPeople.length === 0 ? (
              <p class="ink-subtle">No one is assigned yet.</p>
            ) : (
              <DataGrid
                columns={[
                  { label: "Name" },
                  { label: "Hours", kind: "number" },
                  isHourly && { label: "Rate", kind: "number" },
                  canManageProject && { kind: "action" },
                ]}
              >
                {[...groups].map(([state, people]) => (
                  <>
                    {/* With everyone on the project, a heading would only repeat the section's. */}
                    {groups.size > 1 && <DataGrid.Group>{groupTitles[state]}</DataGrid.Group>}
                    {people.map((person) => (
                      <DataGrid.Row
                        href={
                          canOpenConsultants && !canManageProject
                            ? consultantPath(person.id)
                            : undefined
                        }
                      >
                        <DataGrid.Title secondary={endBadge(person)}>
                          {canOpenConsultants && canManageProject ? (
                            <a href={consultantPath(person.id)}>{person.name}</a>
                          ) : (
                            person.name
                          )}
                        </DataGrid.Title>
                        {formatTotalHours(person.spentMinutes)}
                        {isHourly && rateCell(person, project, canManageProject)}
                        {canManageProject &&
                          (person.state === "onProject" ? (
                            <Button
                              as="a"
                              href={`${projectConsultantsPath(project.id)}/${person.id}/end`}
                              class="aspect-square p-0"
                              data-variant="plain"
                              data-size="small"
                              aria-label={`End ${person.name}'s assignment`}
                              {...{ [attributes.layer]: true }}
                            >
                              <Icon name="close" />
                            </Button>
                          ) : (
                            ""
                          ))}
                      </DataGrid.Row>
                    ))}
                  </>
                ))}
              </DataGrid>
            )}
          </Section>
          <Section title="Hours by month">
            {months.length === 0 ? (
              <p class="ink-subtle">No time is logged yet.</p>
            ) : (
              <DataGrid
                columns={[
                  { label: "Month" },
                  { label: "Hours", kind: "number" },
                  currency !== null && { label: `Amount (${currency})`, kind: "number" },
                ]}
              >
                {months.map((month) => (
                  <DataGrid.Row href={month.href}>
                    <DataGrid.Title>{formatMonth(month.month)}</DataGrid.Title>
                    {formatTotalHours(month.hours * 60)}
                    {currency !== null && formatAmount(month.amount, currency, "exact")}
                  </DataGrid.Row>
                ))}
              </DataGrid>
            )}
          </Section>
          <Section
            title="Tasks"
            actions={[
              canManageProject && {
                label: "Add task",
                href: `/projects/${project.id}/tasks/new`,
                [attributes.layer]: true,
              },
            ]}
          >
            {tasks.length === 0 ? (
              <p class="ink-subtle">No tasks yet.</p>
            ) : (
              <DataGrid columns={[{ label: "Name" }, { label: "Spent", kind: "number" }]}>
                {tasks.map((task) => (
                  <DataGrid.Row>
                    <DataGrid.Title>
                      {canManageProject ? (
                        <a
                          href={`/projects/${project.id}/tasks/${task.id}/edit`}
                          {...{ [attributes.layer]: true }}
                        >
                          {task.name}
                        </a>
                      ) : (
                        task.name
                      )}
                    </DataGrid.Title>
                    {formatTotalHours(task.spentMinutes)}
                  </DataGrid.Row>
                ))}
              </DataGrid>
            )}
          </Section>
        </div>
      </SidebarLayout>
    </Page>
  );
}
