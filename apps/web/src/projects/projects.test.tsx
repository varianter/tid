import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import {
  clients,
  projectOrganizations,
  projects as projectsTable,
  userRoles,
  users,
} from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { assignments } from "../assignments/assignments.routes";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { organizationIdBySlug } from "../testing/rows";
import { projects } from "./projects.routes";

let manager: User;
let member: User;
let bergenManager: User;
let bergenMember: User;
let oslo: number;
let bergen: number;
let clientId: number;

function requestAs(user: User, path: string, form?: Record<string, string>) {
  const app = new Hono<UserEnv>()
    .use(async (c, next) => {
      c.set("user", user);
      await next();
    })
    .route("/projects", projects)
    .route("/projects/:projectId/assignments", assignments);
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
    .returning()) as [User, User, User, User];
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
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  expect(await participants(projectId)).toEqual([{ orgId: oslo, isContractOwner: true }]);

  expect((await requestAs(member, `/projects/${projectId}/edit`, fields)).status).toBe(403);
  const addTask = await requestAs(member, `/projects/${projectId}/tasks`, { name: "Design" });
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
    });

  expect((await start("ACME-2", "fixed_fee")).status).toBe(422);
  const started = await start("ACME-3", "non_billable");
  expect(started.status).toBe(303);
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  expect(await participants(projectId)).toEqual([]);
});

test("employees see only their own country's projects, managers every country's", async () => {
  expect((await requestAs(member, "/projects?company=no")).status).toBe(200);
  expect((await requestAs(member, "/projects?company=se")).status).toBe(404);
  expect((await requestAs(manager, "/projects?company=se")).status).toBe(200);
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
  });
  const projectId = Number(started.headers.get("location")?.split("/").at(-1));
  const addTask = (user: User) =>
    requestAs(user, `/projects/${projectId}/tasks`, { name: `Task ${user.id}` });
  const assign = (user: User, consultant: User) =>
    requestAs(user, `/projects/${projectId}/assignments`, { userId: String(consultant.id) });

  expect((await addTask(bergenManager)).status).toBe(403);
  expect((await assign(bergenManager, member)).status).toBe(403);
  expect((await assign(bergenManager, bergenMember)).status).toBe(303);
  // Bergen takes part now, so its managers share the project.
  expect((await addTask(bergenManager)).status).toBe(303);
  expect((await assign(bergenManager, member)).status).toBe(303);
});

test("a project without logged time changes billing through that billing's form", async () => {
  const started = await requestAs(manager, "/projects/new/non_billable", {
    name: "Fagdag",
    code: "ACME-5",
    billing: "non_billable",
    contractOwnerId: "",
    clientId: String(clientId),
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
