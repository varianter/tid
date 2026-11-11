import { beforeEach, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { users } from "@tid/db/schema";
import { database } from "../framework/database";
import { organizationIdBySlug } from "../testing/rows";
import { loadConsultantHours } from "./consultantHours.data";

let oslo: { id: number; country: "NO"; fullDayMinutes: number };

beforeEach(async () => {
  await rebuildDatabase(database);
  oslo = { id: await organizationIdBySlug("oslo"), country: "NO", fullDayMinutes: 60 };
  await database.insert(users).values([
    { name: "Already here", email: "here@variant.no", orgId: oslo.id },
    { name: "Mid-month", email: "mid@variant.no", orgId: oslo.id, firstDay: "2026-05-18" },
    { name: "Next month", email: "next@variant.no", orgId: oslo.id, firstDay: "2026-06-01" },
    { name: "Gone", email: "gone@variant.no", orgId: oslo.id, lastDay: "2026-04-30" },
  ]);
});

test("month close expects hours only from each consultant's first day", async () => {
  const hours = await loadConsultantHours(oslo, "2026-05");
  expect(hours.map(({ name, expectedMinutes }) => [name, expectedMinutes])).toEqual([
    ["Already here", 18 * 60],
    ["Mid-month", 9 * 60],
  ]);
});
