import { afterEach, beforeAll, expect, mock, spyOn, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { clientAccountManagers, clients as clientsTable, userRoles, users } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { postForm, requestAsUser, type UserRow } from "../testing/loggedInUser";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { clients } from "./clients.routes";

let manager: UserRow;
let member: UserRow;
let bergenMember: UserRow;
let leaver: UserRow;

const mount = (app: Hono<UserEnv>) => app.route("/clients", clients);

const addClient = async (name: string, columns: Partial<typeof clientsTable.$inferInsert> = {}) =>
  onlyRow(
    await database
      .insert(clientsTable)
      .values({ name, ...columns })
      .returning(),
  ).id;

const chooseAccountManagers = (user: UserRow, clientId: number, chosen: UserRow[]) =>
  requestAsUser(
    user,
    mount,
    `/clients/${clientId}/account-managers`,
    postForm(chosen.map((person) => ["userId", String(person.id)])),
  );

const accountManagerIds = async (clientId: number) =>
  (
    await database
      .select({ userId: clientAccountManagers.userId })
      .from(clientAccountManagers)
      .where(eq(clientAccountManagers.clientId, clientId))
  )
    .map((row) => row.userId)
    .toSorted((a, b) => a - b);

const ids = (people: UserRow[]) => people.map((person) => person.id).toSorted((a, b) => a - b);

beforeAll(async () => {
  await rebuildDatabase(database);
  const oslo = await organizationIdBySlug("oslo");
  [manager, member, bergenMember, leaver] = (await database
    .insert(users)
    .values([
      { name: "Kari", email: "kari@variant.no", orgId: oslo },
      { name: "Ola", email: "ola@variant.no", orgId: oslo },
      { name: "Per", email: "per@variant.no", orgId: await organizationIdBySlug("bergen") },
      { name: "Liv", email: "liv@variant.no", orgId: oslo, endsOn: "2026-01-31" },
    ])
    .returning()) as [UserRow, UserRow, UserRow, UserRow];
  await database.insert(userRoles).values({ userId: manager.id, role: "manager" });
});

test("only managers choose a client's account managers", async () => {
  const clientId = await addClient("Acme");
  expect((await chooseAccountManagers(member, clientId, [member])).status).toBe(403);
  expect(await accountManagerIds(clientId)).toEqual([]);
});

test("choosing account managers replaces the set, and can clear it", async () => {
  const clientId = await addClient("Bolt");
  expect((await chooseAccountManagers(manager, clientId, [manager, member])).status).toBe(303);
  expect(await accountManagerIds(clientId)).toEqual(ids([manager, member]));
  const page = await requestAsUser(member, mount, `/clients/${clientId}`);
  const html = await page.text();
  expect(html).toMatch(/>Kari<\/dd>.*>Ola<\/dd>/);

  await chooseAccountManagers(manager, clientId, [member, bergenMember]);
  expect(await accountManagerIds(clientId)).toEqual(ids([member, bergenMember]));

  await chooseAccountManagers(manager, clientId, []);
  expect(await accountManagerIds(clientId)).toEqual([]);
});

test("someone who has left or doesn't exist can't be chosen", async () => {
  const clientId = await addClient("Cirkel");
  const stranger = { ...member, id: 999_999 };
  expect((await chooseAccountManagers(manager, clientId, [member, stranger])).status).toBe(422);
  expect((await chooseAccountManagers(manager, clientId, [leaver])).status).toBe(422);
  expect(await accountManagerIds(clientId)).toEqual([]);
});

test("an account manager who has left stays chosen when the set is saved", async () => {
  const clientId = await addClient("Dugg");
  await database.insert(clientAccountManagers).values({ clientId, userId: leaver.id });
  expect((await chooseAccountManagers(manager, clientId, [leaver, member])).status).toBe(303);
  expect(await accountManagerIds(clientId)).toEqual(ids([leaver, member]));
});

const post = (path: string, fields: Record<string, string> = {}) =>
  requestAsUser(manager, mount, path, postForm(fields));

const get = async (path: string) => (await requestAsUser(manager, mount, path)).text();

const savedClient = async (name: string) =>
  onlyRow(
    await database
      .select({
        id: clientsTable.id,
        organizationNumber: clientsTable.organizationNumber,
        legalName: clientsTable.legalName,
        registeredAddress: clientsTable.registeredAddress,
      })
      .from(clientsTable)
      .where(eq(clientsTable.name, name)),
  );

/** The company register, as it answers over HTTP. */
const registerAnswers = (status: number, body?: unknown) => {
  process.env.ALTINN_LOOKUP_NORDICINFORMATION_API_KEY = "test-key";
  const answer = async () => Response.json(body ?? null, { status });
  spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(answer, { preconnect: fetch.preconnect }),
  );
};

const variantNorge = {
  name: "VARIANT NORGE AS",
  registeredAddress: { fullAddress: "Kongens gate 36;7012 TRONDHEIM;Norway" },
};

afterEach(() => {
  mock.restore();
  delete process.env.ALTINN_LOOKUP_NORDICINFORMATION_API_KEY;
});

test("a new client's organization number is looked up, then saved with the register's name and address", async () => {
  registerAnswers(200, variantNorge);
  const added = await post("/clients/new", { name: "Variant", organizationNumber: "934 160 770" });
  expect(added.status).toBe(303);
  const { id } = await savedClient("Variant");
  const confirm = `/clients/${id}/organization-number/confirm?number=934160770`;
  expect(added.headers.get("location")).toBe(confirm);
  expect(await savedClient("Variant")).toMatchObject({ organizationNumber: null });

  const review = await get(confirm);
  expect(review).toContain("VARIANT NORGE AS");
  expect(review).toContain("7012 TRONDHEIM");

  const confirmed = await post(confirm);
  expect(confirmed.headers.get("location")).toBe(`/clients/${id}`);
  expect(await savedClient("Variant")).toMatchObject({
    organizationNumber: "934160770",
    legalName: "VARIANT NORGE AS",
    registeredAddress: ["Kongens gate 36", "7012 TRONDHEIM", "Norway"],
  });
  const page = await get(`/clients/${id}`);
  expect(page).toContain("934 160 770");
  expect(page).toContain("Kongens gate 36");
});

test("a client asked for from another form goes back to it once its number is confirmed", async () => {
  registerAnswers(200, { name: "VARIANT SVERIGE AB" });
  const added = await post("/clients/new?returnTo=/projects/new/hourly", {
    name: "Variant Sverige",
    organizationNumber: "559433-7999",
  });
  const { id } = await savedClient("Variant Sverige");
  const confirm = added.headers.get("location") ?? "";
  expect(new URL(confirm, "http://tid").searchParams.get("returnTo")).toBe("/projects/new/hourly");
  expect((await post(confirm)).headers.get("location")).toBe(`/projects/new/hourly?client=${id}`);
});

test("a number the register doesn't have can't be saved", async () => {
  registerAnswers(404, { title: "Not found" });
  const clientId = await addClient("Ukjent AS");
  const confirm = `/clients/${clientId}/organization-number/confirm?number=974760673`;
  expect(await get(confirm)).toContain("No company in the register");
  expect((await post(confirm)).status).toBe(422);
  expect(await savedClient("Ukjent AS")).toMatchObject({ organizationNumber: null });
});

test("a number the register can't be asked about can't be saved", async () => {
  registerAnswers(503);
  const clientId = await addClient("Nede AB");
  const confirm = `/clients/${clientId}/organization-number/confirm?number=5560125790`;
  expect(await get(confirm)).toContain("be reached right now");
  expect((await post(confirm)).status).toBe(422);
  expect(await savedClient("Nede AB")).toMatchObject({ organizationNumber: null });
});

test("an organization number must look Norwegian or Swedish, and belong to one client", async () => {
  const clientId = await addClient("Hav AS");
  await addClient("Tatt AS", { organizationNumber: "923609016" });
  const enter = `/clients/${clientId}/organization-number`;
  expect((await post(enter, { organizationNumber: "12345" })).status).toBe(422);

  const taken = await post(enter, { organizationNumber: "923 609 016" });
  expect(taken.status).toBe(422);
  expect(await taken.text()).toContain("Another client has this organization number");
  const takenOnAdding = await post("/clients/new", {
    name: "Fjord AS",
    organizationNumber: "923609016",
  });
  expect(takenOnAdding.status).toBe(422);

  const looksRight = await post(enter, { organizationNumber: "974 760 673" });
  expect(looksRight.headers.get("location")).toBe(`${enter}/confirm?number=974760673`);
});

test("clearing the organization number clears what the register said too", async () => {
  const clientId = await addClient("Klar AS", {
    organizationNumber: "974760673",
    legalName: "KLAR AS",
    registeredAddress: ["Storgata 1", "0155 OSLO", "Norway"],
  });
  expect(
    (await post(`/clients/${clientId}/organization-number`, { organizationNumber: "" })).status,
  ).toBe(303);
  expect(await savedClient("Klar AS")).toMatchObject({
    organizationNumber: null,
    legalName: null,
    registeredAddress: null,
  });
});
