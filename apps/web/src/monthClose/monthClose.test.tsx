import { beforeAll, expect, test } from "bun:test";
import { addMonths } from "@tid/calendar/isoDate";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { rebuildDatabase } from "@tid/db/client";
import { userRoles, users } from "@tid/db/schema";
import { Hono } from "hono";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { organizationIdBySlug } from "../testing/rows";
import { monthClose } from "./monthClose.routes";
import { findActiveLock } from "./monthLock.data";

let manager: User;
let member: User;
let osloManager: User;
let trondheimId: number;

function requestAs(user: User, path: string, method = "GET") {
  const app = new Hono<UserEnv>()
    .use(async (c, next) => {
      c.set("user", user);
      await next();
    })
    .route("/month-close", monthClose);
  return app.request(path, { method });
}

const lastMonth = addMonths(thisMonthInOslo(), -1);

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
    .returning()) as [User, User, User];
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
  const nextMonth = addMonths(thisMonthInOslo(), 1);
  const response = await requestAs(manager, `/month-close/trondheim/${nextMonth}/lock`, "POST");
  expect(response.status).toBe(400);
});

test("locking an unknown organization or month is not found", async () => {
  expect((await requestAs(manager, `/month-close/nowhere/${lastMonth}/lock`, "POST")).status).toBe(
    404,
  );
  expect((await requestAs(manager, "/month-close/trondheim/someday/lock", "POST")).status).toBe(
    404,
  );
});
