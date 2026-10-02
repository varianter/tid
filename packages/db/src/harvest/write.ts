import type { Database } from "../client";
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
} from "../schema";
import type { ImportPlan } from "./plan";

// Postgres caps a statement at 65535 parameters, so large inserts go in chunks.
async function inChunks<Row, Result>(rows: Row[], insert: (chunk: Row[]) => Promise<Result[]>) {
  const results: Result[] = [];
  for (let start = 0; start < rows.length; start += 1000) {
    results.push(...(await insert(rows.slice(start, start + 1000))));
  }
  return results;
}

function lookup<Value>(map: Map<string, Value>, key: string) {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing ${key}`);
  return value;
}

export function writePlan(database: Database, plan: ImportPlan) {
  return database.transaction(async (transaction) => {
    const organizationRows = await inChunks(plan.organizations, (chunk) =>
      transaction.insert(organizations).values(chunk).returning(),
    );
    const organizationIds = new Map(organizationRows.map((row) => [row.slug, row.id]));

    const userRows = await inChunks(plan.users, (chunk) =>
      transaction
        .insert(users)
        .values(
          chunk.map((user) => ({
            name: user.name,
            email: user.email,
            orgId: lookup(organizationIds, user.organization),
          })),
        )
        .returning(),
    );
    const userByEmail = new Map(userRows.map((row) => [row.email.toLowerCase(), row]));
    const userFor = (email: string) => lookup(userByEmail, email.toLowerCase());

    const clientRows = await inChunks(plan.clients, (chunk) =>
      transaction
        .insert(clients)
        .values(chunk.map((name) => ({ name })))
        .returning(),
    );
    const clientIds = new Map(clientRows.map((row) => [row.name, row.id]));

    const projectRows = await inChunks(plan.projects, (chunk) =>
      transaction
        .insert(projects)
        .values(
          chunk.map(({ client, organizations: _, ...project }) => ({
            ...project,
            clientId: lookup(clientIds, client),
          })),
        )
        .returning(),
    );
    const projectIds = new Map(projectRows.map((row) => [row.code, row.id]));

    // The import doesn't decide who owns a project; that's set by hand.
    await inChunks(
      plan.projects.flatMap((project) =>
        project.organizations.map((slug) => ({
          projectId: lookup(projectIds, project.code),
          orgId: lookup(organizationIds, slug),
        })),
      ),
      (chunk) => transaction.insert(projectOrganizations).values(chunk).returning(),
    );

    const taskRows = await inChunks(plan.tasks, (chunk) =>
      transaction
        .insert(tasks)
        .values(
          chunk.map((task) => ({ projectId: lookup(projectIds, task.project), name: task.name })),
        )
        .returning(),
    );
    const taskIds = new Map(taskRows.map((row) => [`${row.projectId}|${row.name}`, row.id]));
    const taskId = (project: string, name: string) =>
      lookup(taskIds, `${lookup(projectIds, project)}|${name}`);

    // Assignments go through the user's own organization, which is one of the project's.
    await inChunks(plan.assignments, (chunk) =>
      transaction
        .insert(projectAssignments)
        .values(
          chunk.map((assignment) => {
            const user = userFor(assignment.email);
            return {
              projectId: lookup(projectIds, assignment.project),
              userId: user.id,
              orgId: user.orgId,
            };
          }),
        )
        .returning(),
    );
    await inChunks(
      plan.assignments.flatMap((assignment) =>
        assignment.rates.map((rate) => ({
          ...rate,
          projectId: lookup(projectIds, assignment.project),
          userId: userFor(assignment.email).id,
        })),
      ),
      (chunk) => transaction.insert(assignmentRates).values(chunk).returning(),
    );

    await inChunks(plan.entries, (chunk) =>
      transaction
        .insert(timeEntries)
        .values(
          chunk.map((entry) => ({
            userId: userFor(entry.email).id,
            taskId: taskId(entry.project, entry.task),
            spentOn: entry.spentOn,
            minutes: entry.minutes,
            notes: entry.notes,
            // Copied from Harvest, so imported time keeps the rate it was logged at.
            rate: entry.rate,
            currency: entry.currency,
          })),
        )
        .returning({ id: timeEntries.id }),
    );
  });
}
