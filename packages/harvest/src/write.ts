// Writes a plan onto whatever the database already holds, which includes what was entered in Tid.
// Rows missing from it are added. Rows that differ from Harvest are reported, and only changed
// when someone accepted the difference. Nothing is deleted.

import type { Database } from "@tid/db/client";
import {
  assignmentRates,
  clients,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  userRoles,
  users,
} from "@tid/db/schema";
import { and, eq, TransactionRollbackError } from "drizzle-orm";
import type { ImportPlan } from "./plan";

export type Difference = {
  // The same in a preview and the write that follows it, so an accepted difference can be named.
  id: string;
  kind: "user" | "client" | "project" | "rate" | "entry";
  // What the row is, like an email or a project code.
  row: string;
  field: string;
  tid: string | null;
  harvest: string | null;
};

// Postgres caps a statement at 65535 parameters, so large inserts go in chunks.
async function inChunks<Row, Result>(rows: Row[], insert: (chunk: Row[]) => Promise<Result[]>) {
  const results: Result[] = [];
  for (let start = 0; start < rows.length; start += 1000) {
    results.push(...(await insert(rows.slice(start, start + 1000))));
  }
  return results;
}

function lookup<Key, Value>(map: Map<Key, Value>, key: Key) {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing ${key}`);
  return value;
}

const describe = (value: unknown) => (value === null || value === undefined ? null : String(value));

// A changed rate applies from today, so time already logged in Tid keeps the rate it got.
const osloToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });

// Drizzle wraps the driver's error, which holds what Postgres said and why.
export function describeRejection(error: unknown) {
  const cause = (error as { cause?: Record<string, unknown> }).cause ?? {};
  const details = [
    cause.message,
    cause.detail,
    cause.constraint && `constraint ${cause.constraint}`,
  ];
  return details.filter(Boolean).join("\n  ") || String(error);
}

// A preview writes everything and rolls it back, so it finds what Postgres would reject too.
export async function writePlan(
  database: Database,
  plan: ImportPlan,
  { accepted = new Set<string>(), preview = false } = {},
) {
  const added = {
    users: [] as string[],
    clients: [] as string[],
    projects: [] as string[],
    participations: [] as string[],
    tasks: [] as string[],
    assignments: [] as string[],
    rates: [] as string[],
    entries: [] as string[],
  };
  const differences: Difference[] = [];
  const compare = async (
    difference: Omit<Difference, "id" | "tid" | "harvest">,
    tid: unknown,
    harvest: unknown,
    change: () => Promise<unknown>,
  ) => {
    if (describe(tid) === describe(harvest)) return;
    const id = `${difference.kind}|${difference.row}|${difference.field}`;
    differences.push({ id, ...difference, tid: describe(tid), harvest: describe(harvest) });
    if (accepted.has(id)) await change();
  };

  const write = database.transaction(async (transaction) => {
    const organizationRows = await transaction.select().from(organizations);
    const organizationIds = new Map(organizationRows.map((row) => [row.slug, row.id]));
    const organizationSlugs = new Map(organizationRows.map((row) => [row.id, row.slug]));

    const userRows = new Map(
      (await transaction.select().from(users)).map((row) => [row.email.toLowerCase(), row]),
    );
    const managerIds = new Set(
      (await transaction.select().from(userRoles).where(eq(userRoles.role, "manager"))).map(
        (row) => row.userId,
      ),
    );
    const newUsers = plan.users.filter((user) => !userRows.has(user.email.toLowerCase()));
    const insertedUsers = await inChunks(newUsers, (chunk) =>
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
    for (const row of insertedUsers) userRows.set(row.email.toLowerCase(), row);
    const userFor = (email: string) => lookup(userRows, email.toLowerCase());
    added.users = newUsers.map((user) => user.email);
    await inChunks(
      newUsers.filter((user) => user.manager),
      (chunk) =>
        transaction
          .insert(userRoles)
          .values(
            chunk.map((user) => ({ userId: userFor(user.email).id, role: "manager" as const })),
          )
          .returning(),
    );
    for (const user of plan.users.filter((user) => !newUsers.includes(user))) {
      const row = userFor(user.email);
      const describeUser = (field: string) => ({ kind: "user" as const, row: user.email, field });
      await compare(describeUser("name"), row.name, user.name, () =>
        transaction.update(users).set({ name: user.name }).where(eq(users.id, row.id)),
      );
      // Postgres rejects this while the user has assignments; see identified-edge-cases.md.
      await compare(
        describeUser("organization"),
        organizationSlugs.get(row.orgId),
        user.organization,
        async () => {
          row.orgId = lookup(organizationIds, user.organization);
          await transaction.update(users).set({ orgId: row.orgId }).where(eq(users.id, row.id));
        },
      );
      await compare(describeUser("manager"), managerIds.has(row.id), user.manager, () =>
        user.manager
          ? transaction.insert(userRoles).values({ userId: row.id, role: "manager" })
          : transaction
              .delete(userRoles)
              .where(and(eq(userRoles.userId, row.id), eq(userRoles.role, "manager"))),
      );
    }

    // Matched by name ignoring case, like the plan does.
    const clientRows = new Map(
      (await transaction.select().from(clients)).map((row) => [row.name.toLowerCase(), row]),
    );
    const newClients = plan.clients.filter((name) => !clientRows.has(name.toLowerCase()));
    for (const row of await inChunks(newClients, (chunk) =>
      transaction
        .insert(clients)
        .values(chunk.map((name) => ({ name })))
        .returning(),
    )) {
      clientRows.set(row.name.toLowerCase(), row);
    }
    added.clients = newClients;
    for (const name of plan.clients.filter((name) => !newClients.includes(name))) {
      const row = lookup(clientRows, name.toLowerCase());
      await compare({ kind: "client", row: name, field: "name" }, row.name, name, async () => {
        row.name = name;
        await transaction.update(clients).set({ name }).where(eq(clients.id, row.id));
      });
    }
    const clientFor = (name: string) => lookup(clientRows, name.toLowerCase());
    const clientNames = new Map([...clientRows.values()].map((row) => [row.id, row.name]));

    const projectRows = new Map(
      (await transaction.select().from(projects)).map((row) => [row.code, row]),
    );
    const newProjects = plan.projects.filter((project) => !projectRows.has(project.code));
    for (const row of await inChunks(newProjects, (chunk) =>
      transaction
        .insert(projects)
        .values(
          chunk.map(({ client, organizations: _, ...project }) => ({
            ...project,
            clientId: clientFor(client).id,
          })),
        )
        .returning(),
    )) {
      projectRows.set(row.code, row);
    }
    added.projects = newProjects.map((project) => project.code);
    for (const project of plan.projects.filter((project) => !newProjects.includes(project))) {
      const row = lookup(projectRows, project.code);
      const describeProject = (field: string) => ({
        kind: "project" as const,
        row: project.code,
        field,
      });
      await compare(
        describeProject("client"),
        clientNames.get(row.clientId),
        clientFor(project.client).name,
        () =>
          transaction
            .update(projects)
            .set({ clientId: clientFor(project.client).id })
            .where(eq(projects.id, row.id)),
      );
      for (const field of [
        "name",
        "billable",
        "openToEveryone",
        "countsTowardBillableBase",
        "startsOn",
        "endsOn",
      ] as const) {
        await compare(describeProject(field), row[field], project[field], () =>
          transaction
            .update(projects)
            .set({ [field]: project[field] })
            .where(eq(projects.id, row.id)),
        );
      }
    }
    const projectId = (code: string) => lookup(projectRows, code).id;

    // The import doesn't decide who owns a project; that's set by hand. Assignments go through the
    // user's organization as Tid has it, which must take part in the project too.
    const participations = new Set(
      (await transaction.select().from(projectOrganizations)).map(
        (row) => `${row.projectId}|${row.orgId}`,
      ),
    );
    const newParticipations = new Map<string, { projectId: number; orgId: number }>();
    const takePart = (code: string, orgId: number) => {
      const key = `${projectId(code)}|${orgId}`;
      if (participations.has(key) || newParticipations.has(key)) return;
      newParticipations.set(key, { projectId: projectId(code), orgId });
      added.participations.push(`${code} ${organizationSlugs.get(orgId)}`);
    };
    for (const project of plan.projects) {
      for (const slug of project.organizations) {
        takePart(project.code, lookup(organizationIds, slug));
      }
    }
    for (const assignment of plan.assignments) {
      takePart(assignment.project, userFor(assignment.email).orgId);
    }
    await inChunks([...newParticipations.values()], (chunk) =>
      transaction.insert(projectOrganizations).values(chunk).returning(),
    );

    const taskIds = new Map(
      (await transaction.select().from(tasks)).map((row) => [
        `${row.projectId}|${row.name}`,
        row.id,
      ]),
    );
    const newTasks = plan.tasks.filter(
      (task) => !taskIds.has(`${projectId(task.project)}|${task.name}`),
    );
    for (const row of await inChunks(newTasks, (chunk) =>
      transaction
        .insert(tasks)
        .values(chunk.map((task) => ({ projectId: projectId(task.project), name: task.name })))
        .returning(),
    )) {
      taskIds.set(`${row.projectId}|${row.name}`, row.id);
    }
    added.tasks = newTasks.map((task) => `${task.project} ${task.name}`);
    const taskId = (project: string, name: string) =>
      lookup(taskIds, `${projectId(project)}|${name}`);

    const assignmentKeys = new Set(
      (await transaction.select().from(projectAssignments)).map(
        (row) => `${row.projectId}|${row.userId}`,
      ),
    );
    const newAssignments = plan.assignments.filter(
      (assignment) =>
        !assignmentKeys.has(`${projectId(assignment.project)}|${userFor(assignment.email).id}`),
    );
    await inChunks(newAssignments, (chunk) =>
      transaction
        .insert(projectAssignments)
        .values(
          chunk.map((assignment) => {
            const user = userFor(assignment.email);
            return { projectId: projectId(assignment.project), userId: user.id, orgId: user.orgId };
          }),
        )
        .returning(),
    );
    added.assignments = newAssignments.map(
      (assignment) => `${assignment.project} ${assignment.email}`,
    );

    // Harvest gives one rate per assignment. A Tid rate that differs was set by hand.
    const tidRates = Map.groupBy(
      (await transaction.select().from(assignmentRates)).toSorted((a, b) =>
        a.validFrom.localeCompare(b.validFrom),
      ),
      (row) => `${row.projectId}|${row.userId}`,
    );
    for (const assignment of plan.assignments) {
      const [rate] = assignment.rates;
      if (!rate) continue;
      const ids = {
        projectId: projectId(assignment.project),
        userId: userFor(assignment.email).id,
      };
      const row = `${assignment.project} ${assignment.email}`;
      const latest = tidRates.get(`${ids.projectId}|${ids.userId}`)?.at(-1);
      if (!latest) {
        await transaction.insert(assignmentRates).values({ ...ids, ...rate });
        added.rates.push(row);
        continue;
      }
      await compare({ kind: "rate", row, field: "rate" }, latest.rate / 100, rate.rate / 100, () =>
        transaction
          .insert(assignmentRates)
          .values({ ...ids, validFrom: osloToday(), rate: rate.rate })
          .onConflictDoUpdate({
            target: [assignmentRates.projectId, assignmentRates.userId, assignmentRates.validFrom],
            set: { rate: rate.rate },
          }),
      );
    }

    // The web import never plans entries, so it shouldn't read every entry ever logged.
    const existingEntries =
      plan.entries.length === 0 ? [] : await transaction.select().from(timeEntries);
    const entryRows = new Map(
      existingEntries.map((row) => [`${row.userId}|${row.taskId}|${row.spentOn}`, row]),
    );
    const priced = (rate: number | null, currency: string | null) =>
      rate === null ? null : `${rate / 100} ${currency}`;
    const newEntries: (typeof timeEntries.$inferInsert)[] = [];
    for (const entry of plan.entries) {
      const values = {
        userId: userFor(entry.email).id,
        taskId: taskId(entry.project, entry.task),
        spentOn: entry.spentOn,
        minutes: entry.minutes,
        notes: entry.notes,
        // Copied from Harvest, so imported time keeps the rate it was logged at.
        rate: entry.rate,
        currency: entry.currency,
      };
      const description = `${entry.email} ${entry.project} ${entry.task} ${entry.spentOn}`;
      const row = entryRows.get(`${values.userId}|${values.taskId}|${values.spentOn}`);
      if (!row) {
        newEntries.push(values);
        added.entries.push(description);
        continue;
      }
      const describeEntry = (field: string) => ({
        kind: "entry" as const,
        row: description,
        field,
      });
      const change = (set: Partial<typeof values>) => () =>
        transaction.update(timeEntries).set(set).where(eq(timeEntries.id, row.id));
      await compare(
        describeEntry("minutes"),
        row.minutes,
        entry.minutes,
        change({ minutes: entry.minutes }),
      );
      await compare(describeEntry("notes"), row.notes, entry.notes, change({ notes: entry.notes }));
      await compare(
        describeEntry("rate"),
        priced(row.rate, row.currency),
        priced(entry.rate, entry.currency),
        change({ rate: entry.rate, currency: entry.currency }),
      );
    }
    await inChunks(newEntries, (chunk) =>
      transaction.insert(timeEntries).values(chunk).returning({ id: timeEntries.id }),
    );

    if (preview) transaction.rollback();
  });
  await write.catch((error) => {
    if (!(error instanceof TransactionRollbackError)) throw error;
  });
  return { added, differences };
}
