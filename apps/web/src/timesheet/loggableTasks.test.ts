import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import {
  clients,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  users,
} from "@tid/db/schema";
import { database } from "../framework/database";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { onBillableAssignment, userTasks } from "./loggableTasks";
import { loadTimesheet } from "./timesheet.data";

let userId: number;
let orgId: number;

beforeAll(async () => {
  await rebuildDatabase(database);
  orgId = await organizationIdBySlug("oslo");
  userId = onlyRow(
    await database
      .insert(users)
      .values({ name: "Kari", email: "kari@variant.no", orgId })
      .returning(),
  ).id;
  const clientId = onlyRow(await database.insert(clients).values({ name: "Acme" }).returning()).id;

  const addProject = async (
    name: string,
    project: Partial<typeof projects.$inferInsert>,
    assignment: Partial<typeof projectAssignments.$inferInsert> = {},
  ) => {
    const { id: projectId } = onlyRow(
      await database
        .insert(projects)
        .values({ clientId, code: name, name, billing: "hourly", currency: "NOK", ...project })
        .returning(),
    );
    await database.insert(tasks).values({ projectId, name: "Development" });
    await database.insert(projectOrganizations).values({ projectId, orgId });
    await database.insert(projectAssignments).values({ projectId, userId, orgId, ...assignment });
  };
  await addProject("Hourly", {});
  await addProject("Fixed fee", { billing: "fixed_fee" });
  await addProject("Starts later", {}, { startsOn: "2026-12-01" });
  await addProject("Ends this month", {}, { endsOn: "2026-10-15" });
  await addProject("Internal", { billing: "non_billable", currency: null });
  await addProject("Rolled off", {}, { endsOn: "2026-09-30" });
  await addProject("Project ended", { endsOn: "2026-09-30" });
});

test("the timesheet shows billable projects the user is assigned to, unless they ended before the month", async () => {
  const shown = await userTasks().where(onBillableAssignment(userId, "2026-10-01"));
  expect(shown.map((task) => task.projectName).sort()).toEqual([
    "Ends this month",
    "Fixed fee",
    "Hourly",
    "Starts later",
  ]);
});

test("a user who hides billable assignments gets none shown unasked", async () => {
  const { assignedTaskIds } = await loadTimesheet({ id: userId, orgId }, "2026-10", false);
  expect(assignedTaskIds).toEqual([]);
});
