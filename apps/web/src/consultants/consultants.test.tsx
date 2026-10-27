import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import {
  clients,
  projectAssignments,
  projectOrganizations,
  projects,
  userRoles,
  users as usersTable,
} from "@tid/db/schema";
import { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { loadLoggedInUser, type UserRow } from "../testing/loggedInUser";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { consultants } from "./consultants.routes";
import { consultantPath } from "./consultants.url";

let manager: UserRow;
let member: UserRow;

function requestAs(user: UserRow, path: string, method = "GET") {
  const app = new Hono<UserEnv>()
    .use(async (c, next) => {
      c.set("user", await loadLoggedInUser(user));
      await next();
    })
    .route("/consultants", consultants);
  return app.request(path, { method });
}

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
    .returning()) as [UserRow, UserRow];
  await database.insert(userRoles).values({ userId: manager.id, role: "manager" });
});

test("members can't see the consultants", async () => {
  expect((await requestAs(member, "/consultants")).status).toBe(403);
});

test("the list starts at the manager's own organization", async () => {
  const response = await requestAs(manager, "/consultants");
  expect(response.headers.get("location")).toBe("/consultants?organization=oslo");
});

test("managers list an organization's consultants, with who's a manager", async () => {
  const page = await (await requestAs(manager, "/consultants?organization=oslo")).text();
  expect(page).toContain("ola@variant.no");
  expect(page).not.toContain("bjorn@variant.no");
  expect((await requestAs(manager, "/consultants?organization=nowhere")).status).toBe(404);
});

test("managers list a whole country's consultants", async () => {
  const norway = await (await requestAs(manager, "/consultants?organization=no")).text();
  expect(norway).toContain("ola@variant.no");
  expect(norway).toContain("bjorn@variant.no");
  const sweden = await (await requestAs(manager, "/consultants?organization=se")).text();
  expect(sweden).not.toContain("ola@variant.no");
});

test("managers see any consultant's details, members only their own", async () => {
  const page = await (await requestAs(manager, consultantPath(member.id))).text();
  expect(page).toContain("ola@variant.no");
  expect((await requestAs(member, consultantPath(member.id))).status).toBe(200);
  expect((await requestAs(member, consultantPath(manager.id))).status).toBe(403);
  expect((await requestAs(manager, consultantPath(0))).status).toBe(404);
  expect((await requestAs(manager, "/consultants/someone")).status).toBe(404);
});

test("a consultant's details show the month asked for", async () => {
  const page = await (await requestAs(member, `/consultants/${member.id}?month=2025-03`)).text();
  expect(page).toContain("March 2025");
  expect(page).toContain(`/consultants/${member.id}?month=2025-02"`);
});

test("a consultant's details list the billable projects they're assigned to now", async () => {
  const client = onlyRow(await database.insert(clients).values({ name: "Kunde" }).returning());
  const projectValues = [
    { code: "NOW1", name: "Current job", billing: "hourly", currency: "NOK" },
    { code: "OLD1", name: "Finished job", billing: "hourly", currency: "NOK" },
    { code: "INT1", name: "Internal job", billing: "non_billable", currency: null },
  ] as const;
  const created = await database
    .insert(projects)
    .values(projectValues.map((project) => ({ ...project, clientId: client.id })))
    .returning();
  const orgId = member.orgId;
  await database
    .insert(projectOrganizations)
    .values(created.map((project) => ({ projectId: project.id, orgId })));
  await database.insert(projectAssignments).values(
    created.map((project) => ({
      projectId: project.id,
      userId: member.id,
      orgId,
      endsOn: project.code === "OLD1" ? "2000-01-01" : null,
    })),
  );
  const page = await (await requestAs(member, consultantPath(member.id))).text();
  expect(page).toContain("Current job");
  expect(page).not.toContain("Finished job");
  expect(page).not.toContain("Internal job");
});
