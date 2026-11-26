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
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { projectConsultants } from "../projectConsultants/projectConsultants.routes";
import { flashLeftBy } from "../testing/flash";
import { postForm, requestAsUser, type UserRow } from "../testing/loggedInUser";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { projects } from "./projects.routes";

let manager: UserRow;
let member: UserRow;
let bergenManager: UserRow;
let bergenMember: UserRow;
let oslo: number;
let bergen: number;
let clientId: number;

const mount = (app: Hono<UserEnv>) =>
  app.route("/projects", projects).route("/projects/:projectId/consultants", projectConsultants);

// Pairs repeat a field, like several ticked checkboxes.
function requestAs(
  user: UserRow,
  path: string,
  form?: Record<string, string> | [string, string][],
) {
  return requestAsUser(user, mount, path, form && postForm(form));
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
  await database.insert(timeEntries).values({
    userId: member.id,
    taskId: task.id,
    spentOn: Temporal.PlainDate.from("2026-01-05"),
    minutes: 60,
  });
  await database.insert(assignmentRates).values({
    projectId,
    userId: member.id,
    validFrom: Temporal.PlainDate.from("2026-01-01"),
    rate: 100000,
  });

  expect((await requestAs(manager, endPath, { endsOn: "2026-02-01" })).status).toBe(303);
  expect(await assignmentEnd()).toEqual([Temporal.PlainDate.from("2026-02-01")]);

  await assign();
  expect(await assignmentEnd()).toEqual([null]);
  expect(
    await database.select().from(assignmentRates).where(eq(assignmentRates.projectId, projectId)),
  ).toHaveLength(1);
});

test("an hourly project flags consultants on it who have no current rate", async () => {
  const started = await requestAs(manager, "/projects/new/hourly", {
    name: "Rates",
    code: "ACME-12",
    billing: "hourly",
    currency: "NOK",
    contractOwnerId: String(oslo),
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  await requestAs(manager, `/projects/${projectId}/consultants/new`, {
    userId: String(member.id),
  });
  const page = async () => (await requestAs(manager, `/projects/${projectId}`)).text();
  expect(await page()).toContain("No rate");

  await database.insert(assignmentRates).values({
    projectId,
    userId: member.id,
    validFrom: Temporal.PlainDate.from("2026-01-01"),
    rate: 100000,
  });
  expect(await page()).not.toContain("No rate");
});

test("adding a rate goes back to the project's rates, saying who it's for and from when", async () => {
  const started = await requestAs(manager, "/projects/new/hourly", {
    name: "Rate flash",
    code: "ACME-23",
    billing: "hourly",
    currency: "NOK",
    contractOwnerId: String(oslo),
    clientId: String(clientId),
    firstTask: "Consulting",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  await requestAs(manager, `/projects/${projectId}/consultants/new`, {
    userId: String(member.id),
  });
  const added = await requestAs(
    manager,
    `/projects/${projectId}/consultants/${member.id}/rates/new`,
    {
      rate: "1400",
      validFrom: "2026-01-01",
    },
  );
  expect(added.headers.get("location")).toBe(`/projects/${projectId}/consultants/rates`);
  expect(await flashLeftBy(added)).toEqual({
    title: "Rate added",
    message: `Added a rate for ${member.name} from 1 January 2026.`,
  });
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

test("adding a task goes back to its project, saying what was added", async () => {
  const projectPath = `/projects/${await startNonBillable("ACME-22")}`;
  const added = await requestAs(manager, `${projectPath}/tasks/new`, { name: "Design" });
  expect(added.headers.get("location")).toBe(projectPath);
  expect(await flashLeftBy(added)).toEqual({
    title: "Task added",
    message: "Added Design to Internal ACME-22.",
  });
});

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
    .values({
      name: "Liv",
      email: "liv@variant.no",
      orgId: oslo,
      lastDay: Temporal.PlainDate.from("2026-01-31"),
    })
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

test("a project's report shows a month", async () => {
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
  const unnamedTab = await requestAs(member, report);
  expect(unnamedTab.headers.get("location")).toBe(`${report}&tab=consultants`);
  const screen = await requestAs(member, `${report}&tab=consultants`);
  expect(screen.status).toBe(200);
});

test("a project's report totals its organization's entries per person and task, grouped either way", async () => {
  const projectId = await startNonBillable("ACME-16");
  const consulting = onlyRow(
    await database.select().from(tasks).where(eq(tasks.projectId, projectId)),
  );
  const design = onlyRow(
    await database.insert(tasks).values({ projectId, name: "Design" }).returning(),
  );
  const entry = (user: UserRow, taskId: number, day: string, minutes: number) => ({
    userId: user.id,
    taskId,
    spentOn: Temporal.PlainDate.from(day),
    minutes,
  });
  await database
    .insert(timeEntries)
    .values([
      entry(member, consulting.id, "2026-10-01", 120),
      entry(member, design.id, "2026-10-02", 60),
      entry(manager, consulting.id, "2026-10-01", 30),
      entry(bergenMember, consulting.id, "2026-10-01", 600),
    ]);
  // Markup aside, so a row reads as its cells: "Ola 3 h".
  const shown = async (tab: string) => {
    const path = `/projects/${projectId}/report?organization=oslo&month=2026-10&tab=${tab}`;
    const html = await (await requestAs(manager, path)).text();
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  };

  // Each group's heading and total, followed by its rows.
  const byConsultant = await shown("consultants");
  expect(byConsultant).toContain("Kari 0,5 h Consulting 0,5 h Ola 3 h Consulting 2 h Design 1 h");
  expect(byConsultant).not.toContain("Per 10 h");
  expect(await shown("tasks")).toContain("Consulting 2,5 h Kari 0,5 h Ola 2 h Design 1 h Ola 1 h");
  expect(await shown("details")).toContain("Ola Design 1 h");
});

test("editing a project sets and clears its invoicing lead, who may have left since", async () => {
  const projectId = await startNonBillable("ACME-13");
  const edit = (invoicingLead: UserRow | undefined) =>
    requestAs(manager, `/projects/${projectId}/edit`, {
      name: "Internal ACME-13",
      code: "ACME-13",
      billing: "non_billable",
      contractOwnerId: String(oslo),
      invoicingLeadId: invoicingLead ? String(invoicingLead.id) : "",
    });
  const invoicingLeadId = async () =>
    onlyRow(
      await database
        .select({ id: projectsTable.invoicingLeadId })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId)),
    ).id;
  const [leftBefore, leftAfter] = (await database
    .insert(users)
    .values([
      {
        name: "Åse",
        email: "ase@variant.no",
        orgId: oslo,
        lastDay: Temporal.PlainDate.from("2026-01-31"),
      },
      {
        name: "Tor",
        email: "tor@variant.no",
        orgId: oslo,
        lastDay: Temporal.PlainDate.from("2026-01-31"),
      },
    ])
    .returning()) as [UserRow, UserRow];

  expect((await edit(bergenMember)).status).toBe(303);
  expect(await invoicingLeadId()).toBe(bergenMember.id);
  expect((await edit(leftBefore)).status).toBe(422);
  expect(await invoicingLeadId()).toBe(bergenMember.id);

  await database
    .update(projectsTable)
    .set({ invoicingLeadId: leftAfter.id })
    .where(eq(projectsTable.id, projectId));
  expect((await edit(leftAfter)).status).toBe(303);
  expect(await invoicingLeadId()).toBe(leftAfter.id);

  expect((await edit(undefined)).status).toBe(303);
  expect(await invoicingLeadId()).toBeNull();
});

test("a project without logged time is deleted with its tasks, consultants and rates", async () => {
  const projectId = await startNonBillable("ACME-14");
  await requestAs(manager, `/projects/${projectId}/consultants/new`, {
    userId: String(member.id),
  });
  await database.insert(assignmentRates).values({
    projectId,
    userId: member.id,
    validFrom: Temporal.PlainDate.from("2026-01-01"),
    rate: 100000,
  });
  const deletePath = `/projects/${projectId}/delete`;
  expect(await (await requestAs(manager, `/projects/${projectId}`)).text()).toContain(deletePath);

  expect((await requestAs(member, deletePath, {})).status).toBe(403);
  const deleted = await requestAs(manager, deletePath, {});
  expect(deleted.status).toBe(303);
  expect(await database.$count(projectsTable, eq(projectsTable.id, projectId))).toBe(0);
  expect(await database.$count(tasks, eq(tasks.projectId, projectId))).toBe(0);
});

test("a project with logged time can't be deleted, even if the hours are zero", async () => {
  const projectId = await startNonBillable("ACME-15");
  const task = onlyRow(await database.select().from(tasks).where(eq(tasks.projectId, projectId)));
  await database.insert(timeEntries).values({
    userId: member.id,
    taskId: task.id,
    spentOn: Temporal.PlainDate.from("2026-01-05"),
    minutes: 0,
  });
  const deletePath = `/projects/${projectId}/delete`;

  expect(await (await requestAs(manager, `/projects/${projectId}`)).text()).not.toContain(
    deletePath,
  );
  expect((await requestAs(manager, deletePath, {})).status).toBe(403);
  expect(await database.$count(projectsTable, eq(projectsTable.id, projectId))).toBe(1);
});

test("a project's managers rename its tasks, but not to a name another of its tasks has", async () => {
  const started = await requestAs(manager, "/projects/new/non_billable", {
    name: "Rebrand",
    code: "ACME-20",
    billing: "non_billable",
    contractOwnerId: "",
    clientId: String(clientId),
    firstTask: "Utvikling",
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  await requestAs(manager, `/projects/${projectId}/tasks/new`, { name: "Design" });
  const taskNamed = async (name: string) =>
    onlyRow(
      await database
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.name, name))),
    );
  const task = await taskNamed("Utvikling");
  const rename = (
    user: UserRow,
    name: string,
    path = `/projects/${projectId}/tasks/${task.id}/edit`,
  ) => requestAs(user, path, { name });

  expect((await rename(member, "Development")).status).toBe(403);
  expect((await rename(manager, "Design")).status).toBe(422);
  expect((await rename(manager, "Development")).status).toBe(303);
  expect((await taskNamed("Development")).id).toBe(task.id);

  const otherProjectId = await startNonBillable("ACME-21");
  const elsewhere = `/projects/${otherProjectId}/tasks/${task.id}/edit`;
  expect((await rename(manager, "Moved", elsewhere)).status).toBe(404);
});
