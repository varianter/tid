import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { clients, projectOrganizations, projects, userRoles, users } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { postForm, requestAsUser, type UserRow } from "../testing/loggedInUser";
import { organizationIdBySlug } from "../testing/rows";
import { administration } from "./administration.routes";

let manager: UserRow;
let member: UserRow;
let bergenManager: UserRow;
let osloId: number;
let internalId: number;
let billableId: number;

const mount = (app: Hono<UserEnv>) => app.route("/administration", administration);

function requestAs(user: UserRow, path: string, form?: Record<string, string>) {
  return requestAsUser(user, mount, path, form && postForm(form));
}

const osloParticipation = async () =>
  database
    .select({
      projectId: projectOrganizations.projectId,
      openToMembers: projectOrganizations.openToMembers,
    })
    .from(projectOrganizations)
    .where(eq(projectOrganizations.orgId, osloId));

beforeAll(async () => {
  await rebuildDatabase(database);
  osloId = await organizationIdBySlug("oslo");
  [manager, member, bergenManager] = (await database
    .insert(users)
    .values([
      { name: "Kari", email: "kari@variant.no", orgId: osloId },
      { name: "Ola", email: "ola@variant.no", orgId: osloId },
      { name: "Bjørn", email: "bjorn@variant.no", orgId: await organizationIdBySlug("bergen") },
    ])
    .returning()) as [UserRow, UserRow, UserRow];
  await database.insert(userRoles).values([
    { userId: manager.id, role: "manager" },
    { userId: bergenManager.id, role: "manager" },
  ]);
  const [client] = await database.insert(clients).values({ name: "Variant" }).returning();
  if (!client) throw new Error("Expected a client");
  [{ id: internalId }, { id: billableId }] = (await database
    .insert(projects)
    .values([
      {
        clientId: client.id,
        code: "INT-1",
        name: "Fagdag",
        billing: "non_billable",
      },
      { clientId: client.id, code: "ACME-1", name: "Website", currency: "NOK", billing: "hourly" },
    ])
    .returning({ id: projects.id })) as [{ id: number }, { id: number }];
});

const path = "/administration/oslo/projects";

test("only managers choose open projects", async () => {
  expect((await requestAs(member, path, { projectId: String(internalId) })).status).toBe(403);
  expect(await osloParticipation()).toEqual([]);

  expect((await requestAs(member, path)).status).toBe(403);
  expect((await requestAs(manager, "/administration/nowhere/projects")).status).toBe(404);
});

test("managers of any organization open a non-billable project, and close it again", async () => {
  const opened = await requestAs(bergenManager, path, { projectId: String(internalId) });
  expect(opened.headers.get("location")).toBe(`${path}?saved`);
  expect(await (await requestAs(manager, `${path}?saved`)).text()).toContain(
    "Your changes have been saved.",
  );
  expect(await osloParticipation()).toEqual([{ projectId: internalId, openToMembers: true }]);
  expect(await (await requestAs(manager, path)).text()).toContain("checked");

  await requestAs(manager, path, {});
  expect(await osloParticipation()).toEqual([]);
});

test("closing keeps the organization on a project it owns", async () => {
  await database
    .insert(projectOrganizations)
    .values({ projectId: internalId, orgId: osloId, isContractOwner: true, openToMembers: true });
  await requestAs(manager, path, {});
  expect(await osloParticipation()).toEqual([{ projectId: internalId, openToMembers: false }]);
  await database.delete(projectOrganizations);
});

test("billable projects aren't listed and can't be opened", async () => {
  expect(await (await requestAs(manager, path)).text()).not.toContain("ACME-1");
  await requestAs(manager, path, { projectId: String(billableId) });
  expect(await osloParticipation()).toEqual([]);
});
