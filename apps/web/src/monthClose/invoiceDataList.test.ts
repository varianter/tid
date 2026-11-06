import { beforeAll, expect, test } from "bun:test";
import { organizations } from "@tid/db/schema";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { seedInvoicingMonth } from "../testing/invoicingMonth";
import { requestAsUser, type UserRow } from "../testing/loggedInUser";
import { monthClose } from "./monthClose.routes";

let member: UserRow;

const mount = (app: Hono<UserEnv>) => app.route("/month-close", monthClose);
const requestAs = (user: UserRow, path: string) => requestAsUser(user, mount, path);

beforeAll(async () => {
  ({ member } = await seedInvoicingMonth());
});

// Every organization invoices, so everyone sees every country's projects.
test("the invoice data page lists every country's hourly projects, and fixed price when asked", async () => {
  const page = async (query: string) =>
    (await requestAs(member, `/month-close/2026-10/invoice-data${query}`)).text();

  const hourly = await page("");
  expect(hourly).toContain("Portal");
  expect(hourly).toContain("Bergen owned");
  expect(hourly).toContain("Swedish");
  expect(hourly).not.toContain("Fixed");
  expect(hourly).not.toContain("Internal");
  expect(await page("?fixedPrice=yes")).toContain("Fixed");
});

test("the invoice data page warns while an organization's month is open", async () => {
  const page = await (await requestAs(member, "/month-close/2026-10/invoice-data")).text();
  // No one has locked October, so every organization is open.
  const count = (await database.select().from(organizations)).length;
  expect(page).toContain(`${count} of ${count} organizations haven&#39;t locked October 2026`);
});
