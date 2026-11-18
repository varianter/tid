import { beforeAll, expect, test } from "bun:test";
import { thisMonthInOslo, todayInOslo } from "@tid/calendar/osloClock";
import { rebuildDatabase } from "@tid/db/client";
import { organizations, userRoles, users } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { capacityMinutes } from "../domain/capacity/capacity";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { requestAsUser, type UserRow } from "../testing/loggedInUser";
import { organizationIdBySlug } from "../testing/rows";
import { loadConsultantHours } from "./consultantHours.data";
import { monthClose } from "./monthClose.routes";
import { findActiveLock } from "./monthLock.data";

let manager: UserRow;
let member: UserRow;
let osloManager: UserRow;
let trondheimId: number;

const mount = (app: Hono<UserEnv>) => app.route("/month-close", monthClose);

function requestAs(user: UserRow, path: string, method = "GET") {
  return requestAsUser(user, mount, path, { method });
}

const lastMonth = thisMonthInOslo().subtract({ months: 1 });

beforeAll(async () => {
  await rebuildDatabase(database);
  trondheimId = await organizationIdBySlug("trondheim");
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

test("only the organization's managers lock and unlock its months", async () => {
  const path = `/month-close/trondheim/${lastMonth}`;
  expect((await requestAs(member, `${path}/lock`, "POST")).status).toBe(403);
  expect((await requestAs(osloManager, `${path}/lock`, "POST")).status).toBe(403);
  expect(await findActiveLock(trondheimId, lastMonth)).toBeUndefined();

  expect((await requestAs(manager, `${path}/lock`, "POST")).status).toBe(303);
  expect(await findActiveLock(trondheimId, lastMonth)).toBeDefined();

  expect((await requestAs(member, `${path}/unlock`, "POST")).status).toBe(403);
  expect((await requestAs(manager, `${path}/unlock`, "POST")).status).toBe(303);
  expect(await findActiveLock(trondheimId, lastMonth)).toBeUndefined();
});

test("a month that hasn't started can't be locked", async () => {
  const nextMonth = thisMonthInOslo().add({ months: 1 });
  const response = await requestAs(manager, `/month-close/trondheim/${nextMonth}/lock`, "POST");
  expect(response.status).toBe(400);
});

async function loadTrondheim() {
  const [organization] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, trondheimId));
  if (!organization) throw new Error("Trondheim must be seeded");
  return organization;
}

test("the current month expects hours only up to today", async () => {
  const organization = await loadTrondheim();
  const month = thisMonthInOslo();
  const dueSoFar = capacityMinutes(
    month,
    organization.country,
    organization.fullDayMinutes,
    todayInOslo(),
  );

  const consultants = await loadConsultantHours(organization, month);

  expect(consultants.map((consultant) => consultant.expectedMinutes)).toEqual(
    consultants.map(() => dueSoFar),
  );
});

test("a future month expects the full month's hours", async () => {
  const organization = await loadTrondheim();
  const nextMonth = thisMonthInOslo().add({ months: 1 });

  const consultants = await loadConsultantHours(organization, nextMonth);

  expect(consultants).toHaveLength(2);
  for (const consultant of consultants) {
    expect(consultant.expectedMinutes).toBeGreaterThan(0);
    expect(consultant.missingMinutes).toBe(consultant.expectedMinutes);
  }
});

test("locking an unknown organization or month is not found", async () => {
  expect((await requestAs(manager, `/month-close/nowhere/${lastMonth}/lock`, "POST")).status).toBe(
    404,
  );
  expect((await requestAs(manager, "/month-close/trondheim/someday/lock", "POST")).status).toBe(
    404,
  );
});
