import { beforeAll, expect, test } from "bun:test";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { seedInvoicingMonth } from "../testing/invoicingMonth";
import { requestAsUser, type UserRow } from "../testing/loggedInUser";
import { reports } from "./reports.routes";

let member: UserRow;

const mount = (app: Hono<UserEnv>) => app.route("/reports", reports);
const requestAs = (user: UserRow, path: string) => requestAsUser(user, mount, path);

beforeAll(async () => {
  ({ member } = await seedInvoicingMonth());
});

test("a report has every hour, and leaves out fixed price only among billable hours", async () => {
  const page = async (filters: string) =>
    (
      await requestAs(member, `/reports?organization=oslo&month=2026-10&tab=projects${filters}`)
    ).text();

  const all = await page("");
  expect(all).toContain(">Fixed<");
  expect(all).toContain("Internal");
  expect(all).not.toContain("Include fixed price");

  const billable = await page("&billable=yes");
  expect(billable).toContain("Portal");
  expect(billable).not.toContain(">Fixed<");
  expect(billable).not.toContain("Internal");
  expect(await page("&billable=yes&fixedPrice=yes")).toContain(">Fixed<");
});
