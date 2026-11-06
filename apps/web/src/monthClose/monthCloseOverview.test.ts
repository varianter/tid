import { beforeAll, expect, test } from "bun:test";
import type { Hono } from "hono";
import { formatAmount } from "../domain/amount/amount";
import type { UserEnv } from "../domain/users/user";
import { seedInvoicingMonth } from "../testing/invoicingMonth";
import { requestAsUser, type UserRow } from "../testing/loggedInUser";
import { monthClose } from "./monthClose.routes";

let member: UserRow;

const mount = (app: Hono<UserEnv>) => app.route("/month-close", monthClose);
const requestAs = (user: UserRow, path: string) => requestAsUser(user, mount, path);

beforeAll(async () => {
  ({ member } = await seedInvoicingMonth());
});

test("the month close overview splits a project's hours by the consultants' organizations", async () => {
  const page = await (await requestAs(member, "/month-close/2026-10")).text();
  // The grid marks each of its parts, so a row is the part that names its organization.
  const parts = page.split('composite-component="DataGrid.');
  const row = (name: string) => parts.find((part) => part.includes(`>${name}</`)) ?? "";

  // Portal is Oslo's, but Per logged an hour on it from Bergen. Fixed price is left out.
  const oslo = row("Oslo");
  expect(oslo).toContain('<data value="8.5">');
  expect(oslo).toContain(formatAmount(11250, "NOK", "withCurrency"));
  expect(row("Bergen")).toContain('<data value="2">');
  // Stockholm billed nothing, so its hours and amount are blank rather than zero.
  expect(row("Stockholm")).not.toContain("<data value=");
  // Ola logged a fraction of October, so Oslo has a consultant to chase.
  expect(oslo).toContain('<data value="1">1</data>');
  expect(oslo).toContain('href="/month-close/2026-10/consultants?organization=oslo"');
  // The organization opens as the report of the same billable hours.
  expect(oslo).toContain(
    'href="/reports?organization=oslo&amp;month=2026-10&amp;tab=projects&amp;billable=yes"',
  );
});
