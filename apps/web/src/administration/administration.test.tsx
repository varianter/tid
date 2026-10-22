import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { userRoles, users } from "@tid/db/schema";
import { Hono } from "hono";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { organizationIdBySlug } from "../testing/rows";
import { administration } from "./administration.routes";

let manager: User;
let member: User;
let osloManager: User;

function requestAs(user: User, path: string, method = "GET") {
  const app = new Hono<UserEnv>()
    .use(async (c, next) => {
      c.set("user", user);
      await next();
    })
    .route("/administration", administration);
  return app.request(path, { method });
}

const managerIds = async () =>
  (await database.select().from(userRoles)).map((role) => role.userId).sort();

beforeAll(async () => {
  await rebuildDatabase(database);
  const trondheimId = await organizationIdBySlug("trondheim");
  [manager, member, osloManager] = (await database
    .insert(users)
    .values([
      { name: "Henrik", email: "henrik@variant.no", orgId: trondheimId },
      { name: "Ola", email: "ola@variant.no", orgId: trondheimId },
      { name: "Kari", email: "kari@variant.no", orgId: await organizationIdBySlug("oslo") },
    ])
    .returning()) as [User, User, User];
  await database.insert(userRoles).values([
    { userId: manager.id, role: "manager" },
    { userId: osloManager.id, role: "manager" },
  ]);
});

test("administration opens on the user's own organization", async () => {
  const response = await requestAs(manager, "/administration");
  expect(response.headers.get("Location")).toBe("/administration/trondheim");
});

test("only the organization's managers administer it", async () => {
  const response = await requestAs(manager, "/administration/trondheim");
  expect(await response.text()).toContain("7,5\u00a0h");
  expect((await requestAs(member, "/administration/trondheim")).status).toBe(403);
  expect((await requestAs(osloManager, "/administration/trondheim")).status).toBe(403);
  expect((await requestAs(manager, "/administration/nowhere")).status).toBe(404);
});

test("managers make their organization's members managers, and remove the role again", async () => {
  const path = `/administration/trondheim/managers/${member.id}`;
  expect((await requestAs(member, path, "POST")).status).toBe(403);
  expect((await requestAs(osloManager, path, "POST")).status).toBe(403);
  expect(await managerIds()).toEqual([manager.id, osloManager.id].sort());

  const response = await requestAs(manager, path, "POST");
  expect(response.headers.get("location")).toBe("/administration/trondheim/managers");
  expect(await managerIds()).toEqual([manager.id, member.id, osloManager.id].sort());

  await requestAs(manager, `${path}/delete`, "POST");
  expect(await managerIds()).toEqual([manager.id, osloManager.id].sort());
});

test("managers can't change the role of someone in another organization", async () => {
  const path = `/administration/trondheim/managers/${osloManager.id}/delete`;
  expect((await requestAs(manager, path, "POST")).status).toBe(404);
  expect(await managerIds()).toContain(osloManager.id);
});
