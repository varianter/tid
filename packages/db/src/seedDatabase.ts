import { sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  openCountries,
  type Person,
  type ProjectCode,
  type ProjectDefinition,
  people,
  projectCatalog,
  recentStartWeek,
  syntheticPeople,
  type TaskDefinition,
  type TaskKey,
  taskCatalog,
} from "./fixtureData";
import { plannedEntries } from "./plannedEntries";
import {
  assignmentRates,
  clients,
  monthLocks,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  userRoles,
  users,
} from "./schema";
import { dayOf, Weekday } from "./week";

// As YYYY-MM-01. The seed locks it so a locked month can be compared against an open one.
export function startOfLastMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 10);
}

function byKey<Row>(rows: Row[], key: (row: Row) => string) {
  return new Map(rows.map((row) => [key(row), row]));
}

function lookup<Value>(map: Map<string, Value>, key: string) {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing ${key}`);
  return value;
}

export function seedDatabase(
  database: Database,
  options: { now?: Date; weeks?: number | undefined; extraPeople?: number | undefined } = {},
) {
  const now = options.now ?? new Date();
  const weeks = options.weeks ?? -recentStartWeek;
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new Error("weeks must be a positive integer");
  }
  const extraPeople = options.extraPeople ?? 0;
  if (!Number.isInteger(extraPeople) || extraPeople < 0) {
    throw new Error("extraPeople must be a non-negative integer");
  }
  const startWeek = -weeks;
  const allPeople = extraPeople === 0 ? people : [...people, ...syntheticPeople(extraPeople)];
  const windowStart = dayOf(now, startWeek, Weekday.Monday);
  const lastMonth = startOfLastMonth(now);
  const projectEntries = Object.entries(projectCatalog) as [ProjectCode, ProjectDefinition][];

  return database.transaction(async (transaction) => {
    const organizationRows = await transaction.select().from(organizations);
    const organizationIds = byKey(organizationRows, (row) => row.slug);
    const organizationId = (slug: string) => lookup(organizationIds, slug).id;

    const userRows = await transaction
      .insert(users)
      .values(
        allPeople.map((person) => ({
          name: person.name,
          email: person.email,
          orgId: organizationId(person.organization),
          createdAt: new Date(
            dayOf(now, Math.max(startWeek, person.joinedWeek ?? startWeek), Weekday.Monday),
          ),
          endsOn:
            person.leftWeek === undefined ? null : dayOf(now, person.leftWeek, Weekday.Friday),
        })),
      )
      .returning();
    const userIds = byKey(userRows, (row) => row.email);
    const userId = (person: Person) => lookup(userIds, person.email).id;

    const managers = allPeople.filter((person) => person.manager);
    await transaction
      .insert(userRoles)
      .values(managers.map((person) => ({ userId: userId(person), role: "manager" as const })));

    const clientNames = [...new Set(projectEntries.map(([, project]) => project.client))];
    const clientRows = await transaction
      .insert(clients)
      .values(clientNames.map((name) => ({ name })))
      .returning();
    const clientIds = byKey(clientRows, (row) => row.name);

    const projectRows = await transaction
      .insert(projects)
      .values(
        projectEntries.map(([code, project]) => ({
          clientId: lookup(clientIds, project.client).id,
          code,
          name: project.name,
          billing: project.billing,
          currency:
            project.billing === "non_billable"
              ? null
              : lookup(organizationIds, project.owner).currency,
          countsTowardBillableBase: project.countsTowardBillableBase ?? true,
          endsOn:
            project.endsWeek === undefined ? null : dayOf(now, project.endsWeek, Weekday.Friday),
        })),
      )
      .returning();
    const projectIds = byKey(projectRows, (row) => row.code);
    const projectId = (code: ProjectCode) => lookup(projectIds, code).id;

    // Internal projects are open to the members of their countries, and no one invoices them.
    // Customer projects are shared by the contract owner and the organizations of the people
    // assigned to them.
    const participants = projectEntries.flatMap(([code, project]) => {
      const isBillable = project.billing !== "non_billable";
      const slugs = isBillable
        ? new Set([
            project.owner,
            ...allPeople
              .filter((person) =>
                person.assignments?.some((assignment) => assignment.project === code),
              )
              .map((person) => person.organization),
          ])
        : organizationRows
            .filter((row) => openCountries(project).includes(row.country))
            .map((row) => row.slug);
      return [...slugs].map((slug) => ({
        projectId: projectId(code),
        orgId: organizationId(slug),
        isContractOwner: isBillable && slug === project.owner,
        openToMembers: !isBillable,
      }));
    });
    await transaction.insert(projectOrganizations).values(participants);

    const taskEntries = Object.entries(taskCatalog) as [TaskKey, TaskDefinition][];
    const taskRows = await transaction
      .insert(tasks)
      .values(
        taskEntries.map(([, task]) => ({
          projectId: projectId(task.project),
          name: task.name,
          endsOn: task.endsWeek === undefined ? null : dayOf(now, task.endsWeek, Weekday.Friday),
        })),
      )
      .returning();
    const taskIdsByName = byKey(taskRows, (row) => `${row.projectId}/${row.name}`);
    const taskId = (key: TaskKey) => {
      const task: TaskDefinition = taskCatalog[key];
      return lookup(taskIdsByName, `${projectId(task.project)}/${task.name}`).id;
    };

    const assignments = allPeople.flatMap((person) =>
      (person.assignments ?? []).map((assignment) => ({ person, ...assignment })),
    );
    await transaction.insert(projectAssignments).values(
      assignments.map(({ person, project }) => ({
        projectId: projectId(project),
        userId: userId(person),
        orgId: organizationId(person.organization),
      })),
    );
    await transaction.insert(assignmentRates).values(
      assignments.flatMap(({ person, project, rates }) =>
        rates.map(({ fromWeek, rate }) => ({
          projectId: projectId(project),
          userId: userId(person),
          validFrom: fromWeek === undefined ? windowStart : dayOf(now, fromWeek, Weekday.Monday),
          // Minor units.
          rate: rate * 100,
        })),
      ),
    );

    await transaction.insert(timeEntries).values(
      allPeople.flatMap((person) =>
        plannedEntries(person, now, startWeek).map(({ task, ...entry }) => ({
          ...entry,
          userId: userId(person),
          taskId: taskId(task),
        })),
      ),
    );
    // Each entry gets the rate a new entry would, like time logged in the app.
    await transaction.execute(
      sql`update time_entries set (rate, currency) = (select rate, currency from entry_rate(user_id, task_id, spent_on))`,
    );

    // Locked last, since a lock rejects new entries in its month. Oslo stays open to compare.
    const trondheimManager = allPeople.find(
      (person) => person.organization === "trondheim" && person.manager,
    );
    if (!trondheimManager) throw new Error("Trondheim needs a manager to lock a month");
    await transaction.insert(monthLocks).values({
      orgId: organizationId("trondheim"),
      month: lastMonth,
      lockedBy: userId(trondheimManager),
    });
  });
}
