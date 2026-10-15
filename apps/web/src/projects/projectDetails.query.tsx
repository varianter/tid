import {
  clients,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  users,
} from "@tid/db/schema";
import { Badge, Button, Detail, Page } from "@tid/ui";
import { and, desc, eq, notExists, sql } from "drizzle-orm";
import type { Context } from "hono";
import { AssignConsultantForm } from "../assignments/assignConsultant.command";
import { RemoveConsultantForm } from "../assignments/removeConsultant.command";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { isManager } from "../users/manager";
import { AddTaskForm } from "./addTask.command";
import { formatSpent, type ProjectSummary, projectSummary } from "./projectSummary";

export const projectDetails = async (c: Context<UserEnv>) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id)) return c.notFound();
  const [project] = await database
    .select(projectSummary)
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.id, id));
  if (!project) return c.notFound();

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

  const assignedPeople = await database
    .select({ id: users.id, name: users.name })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .where(eq(projectAssignments.projectId, id))
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

type Participation = {
  name: string;
  slug: string;
  isContractOwner: boolean;
  openToMembers: boolean;
};

type ProjectDetailsPageProps = {
  project: ProjectSummary;
  tasks: TaskTotal[];
  assignedPeople: Person[];
  /** Everyone not assigned yet, sorted by organization so the picker can group them. */
  assignablePeople: (Person & { orgName: string })[];
  /** The contract owner first, so it reads as the lead organization. */
  participations: Participation[];
  isManager: boolean;
};

function ProjectDetailsPage({
  project,
  tasks,
  assignedPeople,
  assignablePeople,
  participations,
  isManager,
}: ProjectDetailsPageProps) {
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
        <Detail label="Billable">{project.billable ? "Yes" : "No"}</Detail>
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
        <Detail label="Spent">{formatSpent(project.spentMinutes)}</Detail>
      </dl>
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
                <span class="ink-subtle">{formatSpent(task.spentMinutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
          <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
            {assignedPeople.map((person) => (
              <li class="stack-h items-center justify-between gap-xs p-xs px-m surface-tinted">
                {person.name}
                {isManager && (
                  <span class="stack-h gap-xs">
                    <Button
                      as="a"
                      href={`/projects/${project.id}/assignments/${person.id}/rates`}
                      data-variant="plain"
                      data-size="small"
                    >
                      Edit rate
                    </Button>
                    <RemoveConsultantForm projectId={project.id} userId={person.id} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
