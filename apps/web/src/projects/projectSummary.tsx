import {
  clients,
  organizations,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
} from "@tid/db/schema";
import { formatHours } from "@tid/elements/hours";
import { eq, type SQL, sql } from "drizzle-orm";
import { database } from "../database";

const spentMinutes = sql<number>`(
  select coalesce(sum(${timeEntries.minutes}), 0)
  from ${timeEntries} join ${tasks} on ${tasks.id} = ${timeEntries.taskId}
  where ${tasks.projectId} = ${projects.id}
)`.mapWith(Number);

// The contract owner comes first, so it reads as the lead organization.
const participatingOrganizations = sql<string[]>`(
  select coalesce(array_agg(${organizations.name} order by ${projectOrganizations.isContractOwner} desc, ${organizations.name}), '{}')
  from ${projectOrganizations} join ${organizations} on ${organizations.id} = ${projectOrganizations.orgId}
  where ${projectOrganizations.projectId} = ${projects.id}
)`;

/** What a project amounts to at a glance. Select it from projects joined with their client. */
export const projectSummary = {
  id: projects.id,
  name: projects.name,
  code: projects.code,
  billable: projects.billable,
  clientId: clients.id,
  client: clients.name,
  spentMinutes,
  organizations: participatingOrganizations,
};

export type ProjectSummary = {
  id: number;
  name: string;
  code: string;
  billable: boolean;
  clientId: number;
  client: string;
  spentMinutes: number;
  organizations: string[];
};

// Every project, or a client's with `where`, sorted by client so they group.
export const listProjects = (where?: SQL) =>
  database
    .select(projectSummary)
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(where)
    .orderBy(clients.name, projects.name);

export function formatSpent(minutes: number) {
  return `${formatHours(minutes) || "0"} h`;
}

/** Projects with their organizations and time spent, under a heading per client unless `groupByClient` is off. */
export function ProjectTable({
  projects,
  groupByClient = true,
}: {
  projects: ProjectSummary[];
  groupByClient?: boolean;
}) {
  return (
    <div
      class="d-grid of-scroll gap-column-l lh-snug t-tabular"
      style="grid-template-columns: minmax(16ch, 1fr) minmax(12ch, 1fr) max-content;"
    >
      <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
        <span>Name</span>
        <span>Organizations</span>
        <span class="ta-right">Spent</span>
      </div>
      {/* Rows arrive sorted by client, so each group is contiguous. */}
      {[...Map.groupBy(projects, (project) => project.clientId).values()].map((group) => (
        <>
          {groupByClient && (
            <a
              href={`/clients/${group[0]?.clientId}`}
              class="grid-all-columns b-b bc-subtle surface-tinted p-xs py-2xs fs-xs ink-subtle fw-bold"
            >
              {group[0]?.client}
            </a>
          )}
          {group.map((project) => (
            <a
              href={`/projects/${project.id}`}
              class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s"
            >
              <span class="stack-v gap-4xs">
                <span class="fw-medium">{project.name}</span>
                <span class="fs-xs ink-subtle">{project.code}</span>
              </span>
              <span>{project.organizations.join(", ")}</span>
              <span class="ta-right">{formatSpent(project.spentMinutes)}</span>
            </a>
          ))}
        </>
      ))}
    </div>
  );
}
