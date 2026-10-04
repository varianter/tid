import { afterAll, beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { organizations, users } from "@tid/db/schema";
import { Hono } from "hono";
import { database } from "../database";
import { requireProxyUser } from "./login.middleware";
import type { UserEnv } from "./user";

const app = new Hono<UserEnv>()
  .use(requireProxyUser("tenant"))
  .get("/", (c) => c.text(String(c.get("user")?.id)));

function requestAs(headers: Record<string, string>) {
  return app.request("/", { headers });
}

let userId: number;

beforeAll(async () => {
  await rebuildDatabase(database);
  const [organization] = await database
    .insert(organizations)
    .values({ slug: "variant", name: "Variant", currency: "NOK", fullDayMinutes: 450 })
    .returning();
  if (!organization) throw new Error("Expected an organization");
  const [user] = await database
    .insert(users)
    .values({ name: "Kari", email: "kari@variant.no", orgId: organization.id })
    .returning();
  if (!user) throw new Error("Expected a user");
  userId = user.id;
});
afterAll(() => database.$client.close());

test("rejects requests without the proxy headers", async () => {
  expect((await requestAs({})).status).toBe(401);
  expect((await requestAs({ "x-auth-request-email": "kari@variant.no" })).status).toBe(401);
});

test("rejects people who aren't users", async () => {
  const response = await requestAs({
    "x-auth-request-user": "stranger",
    "x-auth-request-email": "stranger@variant.no",
  });
  expect(response.status).toBe(403);
});

test("links by email on first login, then by subject", async () => {
  const first = await requestAs({
    "x-auth-request-user": "kari-sub",
    "x-auth-request-email": "Kari@Variant.no",
  });
  expect(await first.text()).toBe(String(userId));

  const afterEmailChange = await requestAs({
    "x-auth-request-user": "kari-sub",
    "x-auth-request-email": "kari.nordmann@variant.no",
  });
  expect(await afterEmailChange.text()).toBe(String(userId));
});

test("rejects a new subject that reuses a linked user's email", async () => {
  const response = await requestAs({
    "x-auth-request-user": "new-hire-sub",
    "x-auth-request-email": "kari@variant.no",
  });
  expect(response.status).toBe(403);
});
