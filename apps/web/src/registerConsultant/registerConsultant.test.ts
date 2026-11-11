import { beforeEach, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { userRoles, users } from "@tid/db/schema";
import { sql } from "drizzle-orm";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { postForm, requestAsUser, type UserRow } from "../testing/loggedInUser";
import { organizationIdBySlug } from "../testing/rows";
import { registerConsultantRoutes } from "./registerConsultant.routes";
import { registerConsultantPath } from "./registerConsultant.url";

let manager: UserRow;
let consultant: UserRow;
let osloId: number;

const mount = (app: Hono<UserEnv>) =>
  app.route("/administration/register-consultant", registerConsultantRoutes);

const newcomer = (fields: Partial<Record<string, string>> = {}) => ({
  name: "Siri",
  email: "siri@variant.no",
  organizationId: `${osloId}`,
  firstDay: "2027-01-04",
  ...fields,
});

const register = (fields = newcomer(), as = manager) =>
  requestAsUser(as, mount, registerConsultantPath, postForm(fields));

const findByEmail = (email: string) =>
  database.select().from(users).where(sql`lower(${users.email}) = lower(${email})`);

beforeEach(async () => {
  await rebuildDatabase(database);
  osloId = await organizationIdBySlug("oslo");
  [manager, consultant] = (await database
    .insert(users)
    .values([
      { name: "Henrik", email: "henrik@variant.no", orgId: osloId },
      { name: "Kari", email: "kari@variant.no", orgId: osloId },
    ])
    .returning()) as [UserRow, UserRow];
  await database.insert(userRoles).values({ userId: manager.id, role: "manager" });
});

test("a manager registers someone before their first day, then sees their page", async () => {
  const response = await register();
  const [siri] = await findByEmail("siri@variant.no");
  expect(siri).toMatchObject({ name: "Siri", orgId: osloId, firstDay: "2027-01-04" });
  expect(response.headers.get("location")).toStartWith(`/consultants/${siri?.id}`);
});

test("the form starts out in the manager's own organization", async () => {
  const page = await (await requestAsUser(manager, mount, registerConsultantPath)).text();
  expect(page).toMatch(new RegExp(`<option[^>]*value="${osloId}"[^>]*selected`));
});

test("only managers register consultants", async () => {
  expect((await register(newcomer(), consultant)).status).toBe(403);
  expect(await findByEmail("siri@variant.no")).toEqual([]);
});

test("only Variant email addresses", async () => {
  const response = await register(newcomer({ email: "siri@example.com" }));
  expect(response.status).toBe(422);
  expect(await response.text()).toContain("Use their Variant email address");
});

test("the email address must be from the organization's country", async () => {
  const response = await register(newcomer({ email: "siri@variant.se" }));
  expect(response.status).toBe(422);
  expect(await findByEmail("siri@variant.se")).toEqual([]);

  const stockholmId = await organizationIdBySlug("stockholm");
  expect(
    (await register(newcomer({ email: "siri@variant.se", organizationId: `${stockholmId}` })))
      .status,
  ).toBe(303);
});

test("someone already in Tid isn't registered twice, whatever the email's case", async () => {
  const response = await register(newcomer({ email: "Kari@Variant.no" }));
  expect(response.status).toBe(422);
  expect(await response.text()).toContain("Someone with this email is already in Tid");
  expect(await findByEmail("kari@variant.no")).toHaveLength(1);
});

test("the first day is required", async () => {
  expect((await register(newcomer({ firstDay: "" }))).status).toBe(422);
  expect(await findByEmail("siri@variant.no")).toEqual([]);
});
