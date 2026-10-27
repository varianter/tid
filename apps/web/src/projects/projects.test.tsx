import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import {
  assignmentRates,
  clients,
  projectAssignments,
  projectOrganizations,
  projects as projectsTable,
  tasks,
  timeEntries,
  userRoles,
  users,
} from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { projectConsultants } from "../projectConsultants/projectConsultants.routes";
import { loadLoggedInUser, type UserRow } from "../testing/loggedInUser";
import { organizationIdBySlug } from "../testing/rows";
import { projects } from "./projects.routes";

let manager: UserRow;
let member: UserRow;
let bergenManager: UserRow;
let bergenMember: UserRow;
let oslo: number;
let bergen: number;
let clientId: number;

// Pairs repeat a field, like several ticked checkboxes.
function requestAs(
  user: UserRow,
  path: string,
  form?: Record<string, string> | [string, string][],
) {
  const app = new Hono<UserEnv>()
    .use(async (c, next) => {
      c.set("user", await loadLoggedInUser(user));
      await next();
    })
    .route("/projects", projects)
    .route("/projects/:projectId/consultants", projectConsultants);
  return app.request(
    path,
    form ? { method: "POST", body: new URLSearchParams(form) } : { method: "GET" },
  );
}

const participants = async (projectId: number) =>
  database
    .select({
      orgId: projectOrganizations.orgId,
      isContractOwner: projectOrganizations.isContractOwner,
    })
    .from(projectOrganizations)
    .where(eq(projectOrganizations.projectId, projectId));

beforeAll(async () => {
  await rebuildDatabase(database);
  oslo = await organizationIdBySlug("oslo");
  bergen = await organizationIdBySlug("bergen");
  [manager, member, bergenManager, bergenMember] = (await database
    .insert(users)
    .values([
      { name: "Kari", email: "kari@variant.no", orgId: oslo },
      { name: "Ola", email: "ola@variant.no", orgId: oslo },
      { name: "Siri", email: "siri@variant.no", orgId: bergen },
      { name: "Per", email: "per@variant.no", orgId: bergen },
    ])
    .returning()) as [UserRow, UserRow, UserRow, UserRow];
  await database.insert(userRoles).values([
    { userId: manager.id, role: "manager" },
    { userId: bergenManager.id, role: "manager" },
  ]);
  const [client] = await database.insert(clients).values({ name: "Acme" }).returning();
  if (!client) throw new Error("Expected a client");
  clientId = client.id;
});

test("members can't start projects", async () => {
  expect((await requestAs(member, "/projects/new")).status).toBe(403);
  expect((await requestAs(member, "/projects/new/hourly")).status).toBe(403);
  expect(await database.$count(projectsTable)).toBe(0);
});

test("the contract owner moves to the chosen organization on edit", async () => {
  const fields = {
    name: "Website",
    code: "ACME-1",
    billing: "hourly",
    currency: "NOK",
    countsTowardBillableBase: "on",
    contractOwnerId: String(oslo),
  };
  const started = await requestAs(manager, "/projects/new/hourly", {
    ...fields,
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  expect(await participants(projectId)).toEqual([{ orgId: oslo, isContractOwner: true }]);

  expect((await requestAs(member, `/projects/${projectId}/edit`, fields)).status).toBe(403);
  const addTask = await requestAs(member, `/projects/${projectId}/tasks/new`, { name: "Design" });
  expect(addTask.status).toBe(403);
  await requestAs(manager, `/projects/${projectId}/edit`, {
    ...fields,
    contractOwnerId: String(bergen),
  });
  expect(await participants(projectId)).toEqual([{ orgId: bergen, isContractOwner: true }]);
});

test("only non-billable projects can be started without a contract owner", async () => {
  const start = (code: string, billing: string) =>
    requestAs(manager, `/projects/new/${billing}`, {
      name: code,
      code,
      billing,
      currency: "NOK",
      countsTowardBillableBase: "on",
      contractOwnerId: "",
      clientId: String(clientId),
      firstTask: "Consulting",
    });

  expect((await start("ACME-2", "fixed_fee")).status).toBe(422);
  const started = await start("ACME-3", "non_billable");
  expect(started.status).toBe(303);
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  expect(await participants(projectId)).toEqual([]);
});

test("a project starts with its first task", async () => {
  const start = (code: string, firstTask: string) =>
    requestAs(manager, "/projects/new/non_billable", {
      name: code,
      code,
      billing: "non_billable",
      contractOwnerId: "",
      clientId: String(clientId),
      firstTask,
    });

  expect((await start("ACME-7", " ")).status).toBe(422);
  expect(await database.$count(projectsTable, eq(projectsTable.code, "ACME-7"))).toBe(0);
  const started = await start("ACME-7", "Consulting");
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  const projectTasks = await database
    .select({ name: tasks.name })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));
  expect(projectTasks).toEqual([{ name: "Consulting" }]);
});

test("employees see only their own country's projects, managers every country's", async () => {
  expect((await requestAs(member, "/projects?organization=no")).status).toBe(200);
  expect((await requestAs(member, "/projects?organization=se")).status).toBe(404);
  expect((await requestAs(manager, "/projects?organization=se")).status).toBe(200);
});

test("only managers of a project's organizations change it, but any manager can staff it with their own consultants", async () => {
  const started = await requestAs(manager, "/projects/new/hourly", {
    name: "Intranet",
    code: "ACME-4",
    billing: "hourly",
    currency: "NOK",
    countsTowardBillableBase: "on",
    contractOwnerId: String(oslo),
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  const addTask = (user: UserRow) =>
    requestAs(user, `/projects/${projectId}/tasks/new`, { name: `Task ${user.id}` });
  const assign = (user: UserRow, consultant: UserRow) =>
    requestAs(user, `/projects/${projectId}/consultants/new`, {
      userId: String(consultant.id),
    });

  expect((await addTask(bergenManager)).status).toBe(403);
  expect((await assign(bergenManager, member)).status).toBe(422);
  expect((await assign(bergenManager, bergenMember)).status).toBe(303);
  // Bergen takes part now, so its managers share the project.
  expect((await addTask(bergenManager)).status).toBe(303);
  expect((await assign(bergenManager, member)).status).toBe(303);
});

test("a consultant with logged time is rolled off by ending the assignment, which keeps its rates", async () => {
  const started = await requestAs(manager, "/projects/new/non_billable", {
    name: "Rollout",
    code: "ACME-9",
    billing: "non_billable",
    contractOwnerId: String(oslo),
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  const endPath = `/projects/${projectId}/consultants/${member.id}/end`;
  const assign = () =>
    requestAs(manager, `/projects/${projectId}/consultants/new`, {
      userId: String(member.id),
    });
  const assignmentEnd = async () =>
    (
      await database
        .select({ endsOn: projectAssignments.endsOn })
        .from(projectAssignments)
        .where(eq(projectAssignments.projectId, projectId))
    ).map((row) => row.endsOn);
  await assign();
  const [task] = await database.insert(tasks).values({ projectId, name: "Build" }).returning();
  if (!task) throw new Error("Expected a task");
  await database
    .insert(timeEntries)
    .values({ userId: member.id, taskId: task.id, spentOn: "2026-01-05", minutes: 60 });
  await database
    .insert(assignmentRates)
    .values({ projectId, userId: member.id, validFrom: "2026-01-01", rate: 100000 });

  expect((await requestAs(manager, endPath, { endsOn: "2026-02-01" })).status).toBe(303);
  expect(await assignmentEnd()).toEqual(["2026-02-01"]);

  await assign();
  expect(await assignmentEnd()).toEqual([null]);
  expect(
    await database.select().from(assignmentRates).where(eq(assignmentRates.projectId, projectId)),
  ).toHaveLength(1);
});

const startNonBillable = async (code: string) => {
  const started = await requestAs(manager, "/projects/new/non_billable", {
    name: `Internal ${code}`,
    code,
    billing: "non_billable",
    contractOwnerId: String(oslo),
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  return Number(started.headers.get("location")?.split("/").at(-1));
};

const assignedIds = async (projectId: number) =>
  (
    await database
      .select({ userId: projectAssignments.userId })
      .from(projectAssignments)
      .where(eq(projectAssignments.projectId, projectId))
  )
    .map((row) => row.userId)
    .toSorted((a, b) => a - b);

test("consultants are assigned together, and one without logged time is removed by ending the assignment", async () => {
  const projectId = await startNonBillable("ACME-10");
  await requestAs(manager, `/projects/${projectId}/consultants/new`, [
    ["userId", String(member.id)],
    ["userId", String(bergenMember.id)],
  ]);
  expect(await assignedIds(projectId)).toEqual(
    [member.id, bergenMember.id].toSorted((a, b) => a - b),
  );

  const ended = await requestAs(manager, `/projects/${projectId}/consultants/${member.id}/end`, {});
  expect(ended.status).toBe(303);
  expect(await assignedIds(projectId)).toEqual([bergenMember.id]);
});

test("consultants who have left can't be assigned", async () => {
  const projectId = await startNonBillable("ACME-11");
  const [leaver] = await database
    .insert(users)
    .values({ name: "Liv", email: "liv@variant.no", orgId: oslo, endsOn: "2026-01-31" })
    .returning();
  if (!leaver) throw new Error("Expected a user");
  const assign = await requestAs(manager, `/projects/${projectId}/consultants/new`, {
    userId: String(leaver.id),
  });
  expect(assign.status).toBe(422);
  expect(await assignedIds(projectId)).toEqual([]);
});

test("a project without logged time changes billing through that billing's form", async () => {
  const started = await requestAs(manager, "/projects/new/non_billable", {
    name: "Fagdag",
    code: "ACME-5",
    billing: "non_billable",
    contractOwnerId: "",
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  const currency = async () =>
    (
      await database
        .select({ currency: projectsTable.currency })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId))
    )[0]?.currency;
  expect(await currency()).toBeNull();

  const hourly = {
    name: "Fagdag",
    code: "ACME-5",
    billing: "hourly",
    contractOwnerId: String(oslo),
  };
  const edit = `/projects/${projectId}/edit?billing=hourly`;
  expect((await requestAs(manager, edit, { ...hourly, currency: "" })).status).toBe(422);
  expect((await requestAs(manager, edit, { ...hourly, currency: "EUR" })).status).toBe(303);
  expect(await currency()).toBe("EUR");
});

test("a project's report shows a month on screen and links to its print version", async () => {
  const started = await requestAs(manager, "/projects/new/hourly", {
    name: "Rapport",
    code: "ACME-6",
    billing: "hourly",
    currency: "NOK",
    contractOwnerId: String(oslo),
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  const report = `/projects/${projectId}/report?organization=oslo&month=2026-10`;

  expect((await requestAs(member, `/projects/${projectId}/report?month=2026-10`)).status).toBe(302);
  const screen = await requestAs(member, report);
  expect(screen.status).toBe(200);
  expect(await screen.text()).toContain(
    `/projects/${projectId}/report/print?organization=oslo&amp;month=2026-10`,
  );
  const print = await requestAs(
    member,
    `/projects/${projectId}/report/print?organization=oslo&month=2026-10`,
  );
  expect(await print.text()).toContain("Timesheet details");
});
