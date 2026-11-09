import { beforeEach, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import {
  clients,
  monthLocks,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  userRoles,
  users,
} from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { postForm, requestAsUser, type UserRow } from "../testing/loggedInUser";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { changeConsultantOrganizationRoutes } from "./changeConsultantOrganization.routes";
import { changeConsultantOrganizationPath } from "./changeConsultantOrganization.url";

let manager: UserRow;
let newcomer: UserRow;
let osloId: number;
let bergenId: number;

const mount = (app: Hono<UserEnv>) =>
  app.route("/administration/change-consultant-organization", changeConsultantOrganizationRoutes);

const formPath = () => changeConsultantOrganizationPath(newcomer.id);

const changeTo = (orgId: number, as = manager) =>
  requestAsUser(as, mount, formPath(), postForm({ organizationId: `${orgId}` }));

const organizationOf = async (user: UserRow) =>
  onlyRow(await database.select().from(users).where(eq(users.id, user.id))).orgId;

beforeEach(async () => {
  await rebuildDatabase(database);
  osloId = await organizationIdBySlug("oslo");
  bergenId = await organizationIdBySlug("bergen");
  [manager, newcomer] = (await database
    .insert(users)
    .values([
      { name: "Henrik", email: "henrik@variant.no", orgId: bergenId },
      { name: "Kari", email: "kari@variant.no", orgId: osloId },
    ])
    .returning()) as [UserRow, UserRow];
  await database.insert(userRoles).values({ userId: manager.id, role: "manager" });
});

async function internalTask() {
  const client = onlyRow(await database.insert(clients).values({ name: "Variant" }).returning());
  const project = onlyRow(
    await database
      .insert(projects)
      .values({ clientId: client.id, code: "INT", name: "Internal", billing: "non_billable" })
      .returning(),
  );
  await database.insert(projectOrganizations).values({ projectId: project.id, orgId: osloId });
  const task = onlyRow(
    await database.insert(tasks).values({ projectId: project.id, name: "Work" }).returning(),
  );
  return { project, task };
}

test("a manager moves a consultant who chose the wrong organization at sign-up", async () => {
  const response = await changeTo(bergenId);
  expect(response.headers.get("location")).toBe(`${formPath()}&saved`);
  expect(await organizationOf(newcomer)).toBe(bergenId);
  const page = await (await requestAsUser(manager, mount, `${formPath()}&saved`)).text();
  expect(page).toContain("Your changes have been saved.");
  expect(page).toContain("Now in Bergen.");
});

test("without a consultant, it asks for one first and comes back", async () => {
  const response = await requestAsUser(manager, mount, changeConsultantOrganizationPath());
  const location = new URL(response.headers.get("location") ?? "", "http://tid");
  expect(location.pathname).toBe("/administration/consultants/pick");
  expect(location.searchParams.get("returnTo")).toBe(changeConsultantOrganizationPath());
});

test("only managers change organizations", async () => {
  expect((await changeTo(bergenId, newcomer)).status).toBe(403);
  expect(await organizationOf(newcomer)).toBe(osloId);
});

test("only to another organization in the same country", async () => {
  const response = await changeTo(await organizationIdBySlug("stockholm"));
  expect(response.status).toBe(422);
  expect(await organizationOf(newcomer)).toBe(osloId);
});

test("logged time keeps the consultant where they are, and says why", async () => {
  const { task } = await internalTask();
  await database
    .insert(timeEntries)
    .values({ userId: newcomer.id, taskId: task.id, spentOn: "2026-11-02", minutes: 60 });

  const page = await (await requestAsUser(manager, mount, formPath())).text();
  expect(page).toContain("logged time");
  expect(page).not.toContain("Change organization</button>");

  expect((await changeTo(bergenId)).status).toBe(422);
  expect(await organizationOf(newcomer)).toBe(osloId);
});

test("project assignments keep the consultant where they are, and are named", async () => {
  const { project } = await internalTask();
  await database
    .insert(projectAssignments)
    .values({ projectId: project.id, userId: newcomer.id, orgId: osloId });

  const page = await (await requestAsUser(manager, mount, formPath())).text();
  expect(page).toContain("Internal (Variant)");
  expect((await changeTo(bergenId)).status).toBe(422);
  expect(await organizationOf(newcomer)).toBe(osloId);
});

test("having locked a month keeps the consultant where they are", async () => {
  await database
    .insert(monthLocks)
    .values({ orgId: osloId, month: "2026-10-01", lockedBy: newcomer.id });

  expect((await changeTo(bergenId)).status).toBe(422);
  expect(await organizationOf(newcomer)).toBe(osloId);
});
