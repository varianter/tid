// Imports a month saved by harvest-fetch.ts. Re-running it updates the rows it created.
// Usage: bun scripts/harvest-import.ts 2026-08

import { and, between, inArray, sql } from "drizzle-orm";
import { createDatabase } from "../src/client";
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
} from "../src/schema";

type HarvestExport = {
  account: { id: number; name: string };
  users: { id: number; first_name: string; last_name: string; email: string }[];
  projects: {
    id: number;
    code: string;
    name: string;
    is_billable: boolean;
    starts_on: string | null;
    ends_on: string | null;
    client: { name: string };
  }[];
  timeEntries: {
    spent_date: string;
    hours: number;
    notes: string | null;
    billable: boolean;
    billable_rate: number | null;
    user: { id: number };
    client: { currency: string };
    project: { id: number };
    task: { name: string };
  }[];
};

// Non-billable projects of this client are internal, so everyone may log time on them.
const internalClientName = "Varianttid";
// Harvest's weekly capacity is 37.5 hours for everyone.
const fullDayMinutes = 450;
// Slugs appear in URLs, so known accounts get a short one instead of their full name.
const organizationSlugs: Record<number, string> = { 968670: "trondheim" };

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const month = process.argv[2];
if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Pass a month as YYYY-MM");
const monthStart = `${month}-01`;

const exportDirectory = `${import.meta.dir}/../harvest-export/${month}`;
const exportFiles = await Array.fromAsync(new Bun.Glob("*.json").scan(exportDirectory));
if (exportFiles.length === 0) throw new Error(`No exports in ${exportDirectory}`);

const database = createDatabase(url);
type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

function onlyRow<Row>(rows: Row[]) {
  const [row] = rows;
  if (!row) throw new Error("Expected a row");
  return row;
}

function groupBy<Item>(items: Item[], key: (item: Item) => string) {
  const groups = new Map<string, Item[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function importAccount(transaction: Transaction, harvest: HarvestExport) {
  const currencies = new Set(harvest.timeEntries.map((entry) => entry.client.currency));
  if (currencies.size !== 1) throw new Error(`Expected one currency, got ${[...currencies]}`);

  const organization = onlyRow(
    await transaction
      .insert(organizations)
      .values({
        slug: organizationSlugs[harvest.account.id] ?? toSlug(harvest.account.name),
        name: harvest.account.name,
        currency: [...currencies][0] as string,
        fullDayMinutes,
      })
      .onConflictDoUpdate({ target: organizations.slug, set: { name: harvest.account.name } })
      .returning(),
  );

  const userIds = new Map<number, number>();
  for (const harvestUser of harvest.users) {
    const [existing] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${harvestUser.email})`);
    const user =
      existing ??
      onlyRow(
        await transaction
          .insert(users)
          .values({
            name: `${harvestUser.first_name} ${harvestUser.last_name}`,
            email: harvestUser.email,
            orgId: organization.id,
          })
          .returning({ id: users.id }),
      );
    userIds.set(harvestUser.id, user.id);
  }

  // Projects are identified by code, so Harvest projects sharing a code become one.
  const projectIds = new Map<number, number>();
  const openProjectIds = new Set<number>();
  for (const [code, sameCodeProjects] of groupBy(harvest.projects, (project) => project.code)) {
    const [first] = sameCodeProjects as [HarvestExport["projects"][number]];
    if (sameCodeProjects.some((project) => project.client.name !== first.client.name))
      throw new Error(`Projects with code ${code} belong to different clients`);
    if (sameCodeProjects.some((project) => project.is_billable !== first.is_billable))
      throw new Error(`Projects with code ${code} disagree on billable`);

    const client = onlyRow(
      await transaction
        .insert(clients)
        .values({ name: first.client.name })
        .onConflictDoUpdate({ target: clients.name, set: { name: first.client.name } })
        .returning(),
    );
    const startDates = sameCodeProjects.map((project) => project.starts_on);
    const endDates = sameCodeProjects.map((project) => project.ends_on);
    const values = {
      clientId: client.id,
      code,
      name: sameCodeProjects.map((project) => project.name).join(" / "),
      billable: first.is_billable,
      openToEveryone: !first.is_billable && first.client.name === internalClientName,
      // A merged project spans all of its parts, and is open-ended if any part is.
      startsOn: startDates.includes(null) ? null : (startDates.toSorted()[0] ?? null),
      endsOn: endDates.includes(null) ? null : (endDates.toSorted().at(-1) ?? null),
    };
    const project = onlyRow(
      await transaction
        .insert(projects)
        .values(values)
        .onConflictDoUpdate({ target: projects.code, set: values })
        .returning(),
    );
    await transaction
      .insert(projectOrganizations)
      .values({ projectId: project.id, orgId: organization.id, isOwner: true })
      .onConflictDoNothing();

    for (const harvestProject of sameCodeProjects) projectIds.set(harvestProject.id, project.id);
    if (project.openToEveryone) openProjectIds.add(project.id);
  }

  const entries = harvest.timeEntries.map((entry) => {
    const userId = userIds.get(entry.user.id);
    const projectId = projectIds.get(entry.project.id);
    if (!userId || !projectId) throw new Error(`Entry references an unknown user or project`);
    return { ...entry, userId, projectId };
  });

  const taskIds = new Map<string, number>();
  for (const [key, sameTaskEntries] of groupBy(
    entries,
    (entry) => `${entry.projectId}|${entry.task.name}`,
  )) {
    const { projectId, task: harvestTask } = sameTaskEntries[0] as (typeof entries)[number];
    const task = onlyRow(
      await transaction
        .insert(tasks)
        .values({ projectId, name: harvestTask.name })
        .onConflictDoUpdate({
          target: [tasks.projectId, tasks.name],
          set: { name: harvestTask.name },
        })
        .returning(),
    );
    taskIds.set(key, task.id);
  }

  for (const [, assignmentEntries] of groupBy(
    entries,
    (entry) => `${entry.projectId}|${entry.userId}`,
  )) {
    const { projectId, userId } = assignmentEntries[0] as (typeof entries)[number];
    if (openProjectIds.has(projectId)) continue;
    await transaction
      .insert(projectAssignments)
      .values({ projectId, userId, orgId: organization.id })
      .onConflictDoNothing();

    // Fixed fee projects have no rate, so their assignments get none.
    const rates = new Set(
      assignmentEntries.flatMap((entry) =>
        entry.billable_rate === null ? [] : [entry.billable_rate],
      ),
    );
    // ponytail: one rate per assignment and month; split validFrom by date if Harvest rates change mid-month.
    if (rates.size > 1) throw new Error(`Several rates for user ${userId} on project ${projectId}`);
    const [rate] = rates;
    if (rate === undefined) continue;
    const rateValues = { projectId, userId, validFrom: monthStart, rate: Math.round(rate * 100) };
    await transaction
      .insert(assignmentRates)
      .values(rateValues)
      .onConflictDoUpdate({
        target: [assignmentRates.projectId, assignmentRates.userId, assignmentRates.validFrom],
        set: { rate: rateValues.rate },
      });
  }

  // Harvest allows several entries per task and day; we keep one with the notes joined.
  const dayEntries = [
    ...groupBy(
      entries,
      (entry) => `${entry.userId}|${entry.projectId}|${entry.task.name}|${entry.spent_date}`,
    ).values(),
  ].map((sameDayEntries) => {
    const first = sameDayEntries[0] as (typeof entries)[number];
    const hours = sameDayEntries.reduce((total, entry) => total + entry.hours, 0);
    const notes = sameDayEntries.flatMap((entry) =>
      entry.notes?.trim() ? [entry.notes.trim()] : [],
    );
    return {
      userId: first.userId,
      taskId: taskIds.get(`${first.projectId}|${first.task.name}`) as number,
      spentOn: first.spent_date,
      minutes: Math.round(hours * 60),
      notes: notes.length > 0 ? notes.join("\n") : null,
    };
  });
  // ponytail: one insert per account; chunk it if a month nears Postgres' 65535 parameter limit.
  await transaction
    .insert(timeEntries)
    .values(dayEntries)
    .onConflictDoUpdate({
      target: [timeEntries.userId, timeEntries.taskId, timeEntries.spentOn],
      set: { minutes: sql`excluded.minutes`, notes: sql`excluded.notes` },
    });

  // Guards against entries silently lost or merged by the mapping above.
  const lastDay = harvest.timeEntries
    .map((entry) => entry.spent_date)
    .toSorted()
    .at(-1) as string;
  const stored = onlyRow(
    await transaction
      .select({ minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int` })
      .from(timeEntries)
      .where(
        and(
          inArray(timeEntries.userId, [...userIds.values()]),
          between(timeEntries.spentOn, monthStart, lastDay),
        ),
      ),
  );
  const expectedMinutes = dayEntries.reduce((total, entry) => total + entry.minutes, 0);
  if (stored.minutes !== expectedMinutes)
    throw new Error(`Stored ${stored.minutes} minutes, expected ${expectedMinutes}`);

  console.log(
    `${harvest.account.name}: ${harvest.timeEntries.length} Harvest entries as ${dayEntries.length} time entries, ` +
      `${(expectedMinutes / 60).toFixed(2)} hours, ${userIds.size} users, ${taskIds.size} tasks`,
  );
}

await database.transaction(async (transaction) => {
  for (const file of exportFiles) {
    await importAccount(transaction, await Bun.file(`${exportDirectory}/${file}`).json());
  }
});
await database.$client.close();
