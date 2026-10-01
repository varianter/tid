import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
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

test("the export prices an entry with the rate valid on that day", async () => {
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
  await database.insert(timeEntries).values([
    { userId: user.id, taskId: task.id, spentOn: "2026-06-30", minutes: 90 },
    { userId: user.id, taskId: task.id, spentOn: "2026-07-01", minutes: 90 },
  ]);

  const rows = await database
    .select({
      spentDate: timeEntriesExport.spentDate,
      userEmail: timeEntriesExport.userEmail,
      billableRate: timeEntriesExport.billableRate,
      amount: timeEntriesExport.amount,
    })
    .from(timeEntriesExport)
    .orderBy(timeEntriesExport.spentDate);

  expect(rows).toEqual([
    {
      spentDate: "2026-06-30",
      userEmail: "ola@variant.no",
      billableRate: "1000.00",
      amount: "1500.00",
    },
    {
      spentDate: "2026-07-01",
      userEmail: "ola@variant.no",
      billableRate: "1200.00",
      amount: "1800.00",
    },
  ]);
});
