import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { userRoles, users } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { database } from "../database";
import { organizationIdBySlug } from "../testing/rows";
import { requireProxyUser } from "./login.middleware";
import { signupRouter } from "./login.routes";
import type { PublicEnv } from "./user";

const app = new Hono<PublicEnv>()
  .route("/signup", signupRouter("tenant"))
  .use(requireProxyUser("tenant"))
  .get("/", (c) => c.text(String(c.get("user")?.id)));

function requestAs(headers: Record<string, string>, path = "/") {
  return app.request(path, { headers });
}

function signUp(headers: Record<string, string>, form: Record<string, string>) {
  return app.request("/signup", { method: "POST", headers, body: new URLSearchParams(form) });
}

const anna = { "x-auth-request-user": "anna-sub", "x-auth-request-email": "anna@variant.se" };
let kariId: number;

beforeAll(async () => {
  await rebuildDatabase(database);
  const [kari] = await database
    .insert(users)
    .values({ name: "Kari", email: "kari@variant.no", orgId: await organizationIdBySlug("oslo") })
    .returning();
  if (!kari) throw new Error("Expected a user");
  kariId = kari.id;
});

test("rejects requests without the proxy headers", async () => {
  expect((await requestAs({})).status).toBe(401);
  expect((await requestAs({ "x-auth-request-email": "kari@variant.no" })).status).toBe(401);
});

test("sends people who aren't users to sign up", async () => {
  const response = await requestAs({
    "x-auth-request-user": "stranger",
    "x-auth-request-email": "stranger@variant.no",
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/signup");
});

test("links by email on first login, then by subject", async () => {
  const first = await requestAs({
    "x-auth-request-user": "kari-sub",
    "x-auth-request-email": "Kari@Variant.no",
  });
  expect(await first.text()).toBe(String(kariId));

  const afterEmailChange = await requestAs({
    "x-auth-request-user": "kari-sub",
    "x-auth-request-email": "kari.nordmann@variant.no",
  });
  expect(await afterEmailChange.text()).toBe(String(kariId));
});

test("rejects a new subject that reuses a linked user's email", async () => {
  const response = await requestAs({
    "x-auth-request-user": "new-hire-sub",
    "x-auth-request-email": "kari@variant.no",
  });
  expect(response.status).toBe(403);
});

test("sign-up offers only the organizations in the country of the email domain", async () => {
  const page = await (await requestAs(anna, "/signup")).text();
  expect(page).toContain("Linköping");
  expect(page).not.toContain("Oslo");
});

test("sign-up prefills the name from the Entra ID token", async () => {
  const claims = Buffer.from(JSON.stringify({ name: "Ola Martin Nordmann" })).toString("base64url");
  const ola = {
    "x-auth-request-user": "ola-sub",
    "x-auth-request-email": "ola@variant.no",
    authorization: `Bearer header.${claims}.signature`,
  };
  const page = await (await requestAs(ola, "/signup")).text();
  expect(page).toContain('value="Ola Martin Nordmann"');
});

test("sign-up turns away email domains that aren't Variant's", async () => {
  const guest = { "x-auth-request-user": "guest-sub", "x-auth-request-email": "guest@example.com" };
  expect((await requestAs(guest, "/signup")).status).toBe(403);
});

test("sign-up rejects an organization in another country", async () => {
  const oslo = String(await organizationIdBySlug("oslo"));
  const response = await signUp(anna, {
    name: "Anna Svensson",
    organizationId: oslo,
  });
  expect(response.status).toBe(422);
});

test("sign-up creates the user in the chosen organization, who is then logged in", async () => {
  const stockholm = await organizationIdBySlug("stockholm");
  const form = { name: " Anna Svensson ", organizationId: String(stockholm) };
  expect((await signUp(anna, form)).status).toBe(303);

  const [user] = await database.select().from(users).where(eq(users.email, "anna@variant.se"));
  expect(user).toMatchObject({ name: "Anna Svensson", orgId: stockholm });
  expect(await (await requestAs(anna)).text()).toBe(String(user?.id));
  expect((await requestAs(anna, "/signup")).status).toBe(302);
});

test("sign-up makes the bootstrap managers managers, and no one else", async () => {
  process.env.BOOTSTRAP_MANAGER_EMAILS = "someone@variant.se, Erik@Variant.se";
  const stockholm = String(await organizationIdBySlug("stockholm"));
  const erik = { "x-auth-request-user": "erik-sub", "x-auth-request-email": "erik@variant.se" };
  const lisa = { "x-auth-request-user": "lisa-sub", "x-auth-request-email": "lisa@variant.se" };
  await signUp(erik, { name: "Erik", organizationId: stockholm });
  await signUp(lisa, { name: "Lisa", organizationId: stockholm });
  delete process.env.BOOTSTRAP_MANAGER_EMAILS;

  const managers = await database
    .select({ email: users.email })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId));
  expect(managers).toEqual([{ email: "erik@variant.se" }]);
});
