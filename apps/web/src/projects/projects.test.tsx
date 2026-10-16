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
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { organizationIdBySlug } from "../testing/rows";
import { projects } from "./projects.routes";

let manager: User;
let member: User;
let oslo: number;
let bergen: number;
let clientId: number;

function requestAs(user: User, path: string, form?: Record<string, string>) {
  const app = new Hono<UserEnv>()
    .use(async (c, next) => {
      c.set("user", user);
      await next();
    })
    .route("/projects", projects);
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
  [manager, member] = (await database
    .insert(users)
    .values([
      { name: "Kari", email: "kari@variant.no", orgId: oslo },
      { name: "Ola", email: "ola@variant.no", orgId: oslo },
    ])
    .returning()) as [User, User];
  await database.insert(userRoles).values({ userId: manager.id, role: "manager" });
  const [client] = await database.insert(clients).values({ name: "Acme" }).returning();
  if (!client) throw new Error("Expected a client");
  clientId = client.id;
});

test("members can't start projects", async () => {
  expect((await requestAs(member, "/projects/new")).status).toBe(403);
  expect(await database.$count(projectsTable)).toBe(0);
});

test("the contract owner moves to the chosen organization on edit", async () => {
  const fields = {
    name: "Website",
    code: "ACME-1",
    billing: "hourly",
    countsTowardBillableBase: "on",
    contractOwnerId: String(oslo),
  };
  const started = await requestAs(manager, "/projects/new", {
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
    requestAs(manager, "/projects/new", {
      name: code,
      code,
      billing,
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
