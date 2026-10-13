import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
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
  users,
} from "@tid/db/schema";
import { asc, eq } from "drizzle-orm";
import { database } from "../database";
import { addRateAndReprice, entriesToReprice } from "./repricing";

function onlyRow<Row>(rows: Row[]) {
  const [row] = rows;
  if (!row) throw new Error("Expected a row");
  return row;
}

let ids: { projectId: number; userId: number };

beforeAll(async () => {
  await rebuildDatabase(database);
  const organization = onlyRow(
    await database.select().from(organizations).where(eq(organizations.slug, "oslo")),
  );
  const user = onlyRow(
    await database
      .insert(users)
      .values({ name: "Kari", email: "kari@variant.no", orgId: organization.id })
      .returning(),
  );
  const client = onlyRow(await database.insert(clients).values({ name: "Acme" }).returning());
  const project = onlyRow(
    await database
      .insert(projects)
      .values({ clientId: client.id, code: "ACME-1", name: "Website", billable: true })
      .returning(),
  );
  const task = onlyRow(
    await database.insert(tasks).values({ projectId: project.id, name: "Development" }).returning(),
  );
  await database
    .insert(projectOrganizations)
    .values({ projectId: project.id, orgId: organization.id, isOwner: true });
  ids = { projectId: project.id, userId: user.id };
  await database.insert(projectAssignments).values({ ...ids, orgId: organization.id });
  await database.insert(assignmentRates).values([
    { ...ids, validFrom: "2026-01-01", rate: 100000 },
    { ...ids, validFrom: "2026-07-01", rate: 120000 },
  ]);
  const entry = { userId: user.id, taskId: task.id, minutes: 60, currency: "NOK" };
  await database.insert(timeEntries).values([
    // Copied from Harvest, at a rate the rate history doesn't have.
    { ...entry, spentOn: "2026-02-27", rate: 99900 },
    { ...entry, spentOn: "2026-03-02", rate: 100000 },
    { ...entry, spentOn: "2026-07-01", rate: 120000 },
  ]);
  await database
    .insert(monthLocks)
    .values({ orgId: organization.id, month: "2026-03-01", lockedBy: user.id });
});

test("a backdated rate reprices its period up to the next rate, locked months included", async () => {
  const newRate = { validFrom: "2026-03-01", rate: 110000, currency: "NOK" };

  expect(await entriesToReprice(ids, newRate)).toMatchObject([
    { spentOn: "2026-03-02", rate: 100000, isLocked: true },
  ]);

  await addRateAndReprice(ids, newRate);
  const rates = await database
    .select({ spentOn: timeEntries.spentOn, rate: timeEntries.rate })
    .from(timeEntries)
    .orderBy(asc(timeEntries.spentOn));
  expect(rates).toEqual([
    { spentOn: "2026-02-27", rate: 99900 },
    { spentOn: "2026-03-02", rate: 110000 },
    { spentOn: "2026-07-01", rate: 120000 },
  ]);
  expect(await entriesToReprice(ids, newRate)).toEqual([]);
});
