import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { timing } from "hono/timing";
import { database } from "./database";
import { reportDatabaseTiming, summarizeQuery } from "./serverTiming";

// Guards the patched Drizzle internal, which an upgrade could rename.
test("reports queries inside and outside transactions", async () => {
  const app = new Hono();
  app.use(timing(), reportDatabaseTiming);
  app.get("/", async (c) => {
    await database.execute(sql`select 1`);
    await database.transaction((transaction) => transaction.execute(sql`select 1`));
    return c.text("ok");
  });

  const response = await app.request("/");

  const serverTiming = response.headers.get("Server-Timing");
  expect(serverTiming).toMatch(/db;dur=\d+\.\d;desc="2 queries"/);
  expect(serverTiming).toMatch(/db-2;dur=\d+\.\d;desc="select"/);
});

test("summarizes a query as its statement and first table", () => {
  expect(summarizeQuery(`select "id" from "time_entries" where "user_id" = $1`)).toBe(
    "select time_entries",
  );
  expect(summarizeQuery(`insert into "users" ("name") values ($1)`)).toBe("insert users");
  expect(summarizeQuery(`update "projects" set "name" = $1`)).toBe("update projects");
  expect(summarizeQuery("select 1")).toBe("select");
});
