import {
  clients,
  organizations,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
} from "@tid/db/schema";
import { formatHours } from "@tid/elements/hours";
import { DataGrid } from "@tid/ui";
import { eq, type SQL, sql } from "drizzle-orm";
import { database } from "../database";
import type { Billing } from "./billing";

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
  billing: projects.billing,
  clientId: clients.id,
  client: clients.name,
  spentMinutes,
  organizations: participatingOrganizations,
};

export type ProjectSummary = {
  id: number;
  name: string;
  code: string;
  billing: Billing;
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
    <DataGrid
      columns={[{ label: "Name" }, { label: "Organizations" }, { label: "Spent", kind: "number" }]}
    >
      {/* Rows arrive sorted by client, so each group is contiguous. */}
      {[...Map.groupBy(projects, (project) => project.clientId).values()].map((group) => (
        <>
          {groupByClient && (
            <DataGrid.Group href={`/clients/${group[0]?.clientId}`}>
              {group[0]?.client}
            </DataGrid.Group>
          )}
          {group.map((project) => (
            <DataGrid.Row href={`/projects/${project.id}`}>
              <DataGrid.Title secondary={project.code}>{project.name}</DataGrid.Title>
              {project.organizations.join(", ")}
              {formatSpent(project.spentMinutes)}
            </DataGrid.Row>
          ))}
        </>
      ))}
    </DataGrid>
  );
}
