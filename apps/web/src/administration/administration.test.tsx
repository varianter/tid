import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { userRoles, users } from "@tid/db/schema";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { requestAsUser, type UserRow } from "../testing/loggedInUser";
import { organizationIdBySlug } from "../testing/rows";
import { administration } from "./administration.routes";

let manager: UserRow;
let member: UserRow;
let osloManager: UserRow;

const mount = (app: Hono<UserEnv>) => app.route("/administration", administration);

function requestAs(user: UserRow, path: string, method = "GET") {
  return requestAsUser(user, mount, path, { method });
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
    .returning()) as [UserRow, UserRow, UserRow];
  await database.insert(userRoles).values([
    { userId: manager.id, role: "manager" },
    { userId: osloManager.id, role: "manager" },
  ]);
});

test("administration's pages open on the manager's own organization", async () => {
  expect((await requestAs(manager, "/administration")).status).toBe(200);
  const response = await requestAs(manager, "/administration/managers");
  expect(response.headers.get("Location")).toBe("/administration/managers?organization=trondheim");
});

test("any manager administers any organization, one at a time", async () => {
  const path = "/administration/managers?organization=trondheim";
  expect(await (await requestAs(osloManager, path)).text()).toContain("Managers in Trondheim");
  expect((await requestAs(member, path)).status).toBe(403);
  expect((await requestAs(member, "/administration")).status).toBe(403);
  expect((await requestAs(manager, "/administration/managers?organization=nowhere")).status).toBe(
    404,
  );
  // A whole country isn't one organization to change.
  expect((await requestAs(manager, "/administration/managers?organization=no")).status).toBe(404);
});

test("administering another organization says so, with a way back", async () => {
  const notice = "You are currently in the Administration of";
  const own = await (
    await requestAs(manager, "/administration/managers?organization=trondheim")
  ).text();
  expect(own).not.toContain(notice);
  const page = await (
    await requestAs(osloManager, "/administration/managers?organization=trondheim")
  ).text();
  expect(page).toContain(notice);
  expect(page).toContain('href="/administration/managers?organization=oslo"');
});

test("managers make an organization's members managers, and remove the role again", async () => {
  const path = `/administration/managers/${member.id}`;
  expect((await requestAs(member, path, "POST")).status).toBe(403);
  expect(await managerIds()).toEqual([manager.id, osloManager.id].sort());

  const response = await requestAs(osloManager, path, "POST");
  expect(response.headers.get("location")).toBe("/administration/managers?organization=trondheim");
  expect(await managerIds()).toEqual([manager.id, member.id, osloManager.id].sort());

  await requestAs(manager, `${path}/delete`, "POST");
  expect(await managerIds()).toEqual([manager.id, osloManager.id].sort());
  expect((await requestAs(manager, "/administration/managers/0", "POST")).status).toBe(404);
});

test("the consultant picker hands the chosen consultant on to where it was asked from", async () => {
  const returnTo = "/administration/change-consultant-organization";
  const query = new URLSearchParams({ organization: "trondheim", returnTo });
  const page = await (await requestAs(manager, `/administration/consultants/pick?${query}`)).text();
  expect(page).toContain(`href="${returnTo}?userId=${member.id}"`);
  expect(page).not.toContain(osloManager.name);
  // Switching organization keeps where to go next.
  expect(page).toContain(`name="returnTo" value="${returnTo}"`);
});

test("the consultant picker goes nowhere it isn't told to, nor off this site", async () => {
  expect((await requestAs(manager, "/administration/consultants/pick")).status).toBe(404);
  const offSite = `/administration/consultants/pick?returnTo=${encodeURIComponent("//evil.example")}`;
  expect((await requestAs(manager, offSite)).status).toBe(404);
  expect((await requestAs(member, "/administration/consultants/pick?returnTo=/")).status).toBe(403);
});
