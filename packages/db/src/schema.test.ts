import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { createDatabase, rebuildDatabase } from "./client";
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
} from "./schema";

// The test preload points DATABASE_URL at a throwaway container.
const database = createDatabase(process.env.DATABASE_URL ?? "");

// Start empty so every run applies the full chain of migrations.
beforeAll(() => rebuildDatabase(database));
afterAll(() => database.$client.close());
beforeEach(async () => {
  await database.execute(sql`truncate organizations, clients restart identity cascade`);
});

function onlyRow<Row>(rows: Row[]) {
  const [row] = rows;
  if (!row) throw new Error("Expected a row");
  return row;
}

async function insertOrganization(slug: string) {
  return onlyRow(
    await database
      .insert(organizations)
      .values({ slug, name: slug, currency: "NOK", fullDayMinutes: 450 })
      .returning(),
  );
}

async function insertUser(email: string, orgId: number) {
  return onlyRow(await database.insert(users).values({ name: email, email, orgId }).returning());
}

async function insertProject() {
  const organization = await insertOrganization("variant");
  const client = onlyRow(await database.insert(clients).values({ name: "Acme" }).returning());
  const project = onlyRow(
    await database
      .insert(projects)
      .values({ clientId: client.id, code: "ACME-1", name: "Website", billable: true })
      .returning(),
  );
  await database
    .insert(projectOrganizations)
    .values({ projectId: project.id, orgId: organization.id, isOwner: true });
  return { organization, project };
}

async function violatedConstraint(query: Promise<unknown>) {
  const error = await query.then(
    () => undefined,
    (error: Error) => error,
  );
  return (error?.cause as { constraint?: string } | undefined)?.constraint;
}

test("a project has at most one owning organization", async () => {
  const { project } = await insertProject();
  const other = await insertOrganization("other");

  expect(
    await violatedConstraint(
      database
        .insert(projectOrganizations)
        .values({ projectId: project.id, orgId: other.id, isOwner: true }),
    ),
  ).toBe("project_organizations_one_owner");
});

test("only users from one of the project's organizations can be assigned", async () => {
  const { organization, project } = await insertProject();
  const other = await insertOrganization("other");
  const outsider = await insertUser("kari@other.no", other.id);

  expect(
    await violatedConstraint(
      database
        .insert(projectAssignments)
        .values({ projectId: project.id, userId: outsider.id, orgId: other.id }),
    ),
  ).toBe("project_assignments_organization_on_project");

  expect(
    await violatedConstraint(
      database
        .insert(projectAssignments)
        .values({ projectId: project.id, userId: outsider.id, orgId: organization.id }),
    ),
  ).toBe("project_assignments_user_in_organization");
});

test("emails are unique regardless of case", async () => {
  const { organization } = await insertProject();
  await database
    .insert(users)
    .values({ name: "Ola", email: "ola@variant.no", orgId: organization.id });

  expect(
    await violatedConstraint(
      database
        .insert(users)
        .values({ name: "Ola", email: "Ola@Variant.no", orgId: organization.id }),
    ),
  ).toBe("users_email_unique");
});

async function insertRatedAssignment() {
  const { organization, project } = await insertProject();
  const user = await insertUser("ola@variant.no", organization.id);
  const task = onlyRow(
    await database.insert(tasks).values({ projectId: project.id, name: "Development" }).returning(),
  );
  await database
    .insert(projectAssignments)
    .values({ projectId: project.id, userId: user.id, orgId: organization.id });
  await database.insert(assignmentRates).values([
    { projectId: project.id, userId: user.id, validFrom: "2026-01-01", rate: 100000 },
    { projectId: project.id, userId: user.id, validFrom: "2026-07-01", rate: 120000 },
  ]);
  return { organization, project, user, task };
}

async function entryRate(userId: number, taskId: number, spentOn: string) {
  const rows = await database.execute<{ rate: number; currency: string }>(
    sql`select rate, currency from entry_rate(${userId}, ${taskId}, ${spentOn})`,
  );
  return [...rows];
}

test("a new entry gets the assignment rate valid on its day, in the user's currency", async () => {
  const { user, task } = await insertRatedAssignment();

  expect(await entryRate(user.id, task.id, "2025-12-31")).toEqual([]);
  expect(await entryRate(user.id, task.id, "2026-06-30")).toEqual([
    { rate: 100000, currency: "NOK" },
  ]);
  expect(await entryRate(user.id, task.id, "2026-07-01")).toEqual([
    { rate: 120000, currency: "NOK" },
  ]);
});

test("moving an entry to another task picks the rate again; changing its minutes doesn't", async () => {
  const { organization, project, user, task } = await insertRatedAssignment();
  const otherTask = onlyRow(
    await database.insert(tasks).values({ projectId: project.id, name: "Design" }).returning(),
  );
  const internalClient = onlyRow(
    await database.insert(clients).values({ name: "Variant" }).returning(),
  );
  const internalProject = onlyRow(
    await database
      .insert(projects)
      .values({ clientId: internalClient.id, code: "VAR1000", name: "Drift", billable: false })
      .returning(),
  );
  await database
    .insert(projectOrganizations)
    .values({ projectId: internalProject.id, orgId: organization.id });
  const unratedTask = onlyRow(
    await database
      .insert(tasks)
      .values({ projectId: internalProject.id, name: "Admin" })
      .returning(),
  );
  // A rate that differs from the list, like one copied from Harvest.
  const entry = onlyRow(
    await database
      .insert(timeEntries)
      .values({
        userId: user.id,
        taskId: task.id,
        spentOn: "2026-07-01",
        minutes: 60,
        rate: 99900,
        currency: "NOK",
      })
      .returning(),
  );
  const priceAfter = async (change: Partial<typeof timeEntries.$inferInsert>) => {
    const { rate, currency } = onlyRow(
      await database
        .update(timeEntries)
        .set(change)
        .where(eq(timeEntries.id, entry.id))
        .returning(),
    );
    return { rate, currency };
  };

  expect(await priceAfter({ minutes: 90 })).toEqual({ rate: 99900, currency: "NOK" });
  expect(await priceAfter({ taskId: otherTask.id })).toEqual({ rate: 120000, currency: "NOK" });
  expect(await priceAfter({ taskId: unratedTask.id })).toEqual({ rate: null, currency: null });
});

test("a rate needs a currency", async () => {
  const { user, task } = await insertRatedAssignment();

  expect(
    await violatedConstraint(
      database
        .insert(timeEntries)
        .values({ userId: user.id, taskId: task.id, spentOn: "2026-07-01", minutes: 60, rate: 1 }),
    ),
  ).toBe("rate_has_currency");
});

test("the export prices an entry with its locked rate", async () => {
  const { user, task } = await insertRatedAssignment();
  await database.insert(timeEntries).values([
    {
      userId: user.id,
      taskId: task.id,
      spentOn: "2026-07-01",
      minutes: 90,
      rate: 150000,
      currency: "NOK",
    },
    { userId: user.id, taskId: task.id, spentOn: "2026-07-02", minutes: 90 },
  ]);

  const rows = await database
    .select({
      spentDate: timeEntriesExport.spentDate,
      billableRate: timeEntriesExport.billableRate,
      amount: timeEntriesExport.amount,
    })
    .from(timeEntriesExport)
    .orderBy(timeEntriesExport.spentDate);

  expect(rows).toEqual([
    { spentDate: "2026-07-01", billableRate: "1500.00", amount: "2250.00" },
    { spentDate: "2026-07-02", billableRate: null, amount: null },
  ]);
});

test("the export leaves time on projects that don't count out of billable base hours", async () => {
  const { organization, user } = await insertRatedAssignment();
  const internalClient = onlyRow(
    await database.insert(clients).values({ name: "Variant" }).returning(),
  );
  const internalTask = async (code: string, countsTowardBillableBase: boolean) => {
    const project = onlyRow(
      await database
        .insert(projects)
        .values({
          clientId: internalClient.id,
          code,
          name: code,
          billable: false,
          countsTowardBillableBase,
        })
        .returning(),
    );
    await database
      .insert(projectOrganizations)
      .values({ projectId: project.id, orgId: organization.id });
    return onlyRow(
      await database.insert(tasks).values({ projectId: project.id, name: code }).returning(),
    );
  };
  const administration = await internalTask("VAR1001", true);
  const vacation = await internalTask("FER1000", false);
  await database.insert(timeEntries).values([
    { userId: user.id, taskId: administration.id, spentOn: "2026-07-01", minutes: 90 },
    { userId: user.id, taskId: vacation.id, spentOn: "2026-07-02", minutes: 450 },
  ]);

  const rows = await database
    .select({
      projectCode: timeEntriesExport.projectCode,
      billableHours: timeEntriesExport.billableHours,
      billableBaseHours: timeEntriesExport.billableBaseHours,
    })
    .from(timeEntriesExport)
    .orderBy(timeEntriesExport.spentDate);

  expect(rows).toEqual([
    { projectCode: "VAR1001", billableHours: "0", billableBaseHours: "1.50" },
    { projectCode: "FER1000", billableHours: "0", billableBaseHours: "0" },
  ]);
});

test("a billable project counts toward billable base hours", async () => {
  const client = onlyRow(await database.insert(clients).values({ name: "Acme" }).returning());

  expect(
    await violatedConstraint(
      database.insert(projects).values({
        clientId: client.id,
        code: "ACME-1",
        name: "Website",
        billable: true,
        countsTowardBillableBase: false,
      }),
    ),
  ).toBe("billable_projects_count_toward_base");
});
