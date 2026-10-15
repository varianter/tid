import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { userRoles, users as usersTable } from "@tid/db/schema";
import { Hono } from "hono";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { organizationIdBySlug } from "../testing/rows";
import { users } from "./users.routes";

let manager: User;
let member: User;

function requestAs(user: User, path: string, method = "GET") {
  const app = new Hono<UserEnv>()
    .use(async (c, next) => {
      c.set("user", user);
      await next();
    })
    .route("/users", users);
  return app.request(path, { method });
}

const managerIds = async () => (await database.select().from(userRoles)).map((role) => role.userId);

beforeAll(async () => {
  await rebuildDatabase(database);
  const oslo = await organizationIdBySlug("oslo");
  [manager, member] = (await database
    .insert(usersTable)
    .values([
      { name: "Kari", email: "kari@variant.no", orgId: oslo },
      { name: "Ola", email: "ola@variant.no", orgId: oslo },
      { name: "Bjørn", email: "bjorn@variant.no", orgId: await organizationIdBySlug("bergen") },
    ])
    .returning()) as [User, User];
  await database.insert(userRoles).values({ userId: manager.id, role: "manager" });
});

test("members can't see or change users", async () => {
  expect((await requestAs(member, "/users")).status).toBe(403);
  expect((await requestAs(member, `/users/${member.id}/manager`, "POST")).status).toBe(403);
  expect(await managerIds()).toEqual([manager.id]);
});

test("the list starts at the manager's own organization", async () => {
  const response = await requestAs(manager, "/users");
  expect(response.headers.get("location")).toBe("/users?organization=oslo");
});

test("managers list an organization's users, with who's a manager", async () => {
  const page = await (await requestAs(manager, "/users?organization=oslo")).text();
  expect(page).toContain("ola@variant.no");
  expect(page).not.toContain("bjorn@variant.no");
  expect(page).toContain(`/users/${member.id}/manager?organization=oslo"`);
  expect(page).toContain(`/users/${manager.id}/manager/delete?organization=oslo"`);
  expect((await requestAs(manager, "/users?organization=nowhere")).status).toBe(404);
});

test("managers make others managers, and remove the role again", async () => {
  const response = await requestAs(
    manager,
    `/users/${member.id}/manager?organization=oslo`,
    "POST",
  );
  expect(response.headers.get("location")).toBe("/users?organization=oslo");
  await requestAs(manager, `/users/${member.id}/manager?organization=oslo`, "POST");
  expect((await managerIds()).sort()).toEqual([manager.id, member.id].sort());

  await requestAs(manager, `/users/${member.id}/manager/delete?organization=oslo`, "POST");
  expect(await managerIds()).toEqual([manager.id]);
});
