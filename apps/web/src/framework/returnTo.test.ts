import { expect, test } from "bun:test";
import { Hono } from "hono";
import { returnTo } from "./returnTo";

const app = new Hono().get("/", (c) => c.json(returnTo(c, { client: "7" }) ?? null));
const returnToFor = async (path: string) =>
  (await app.request(`/?returnTo=${encodeURIComponent(path)}`)).json();

test("returns to a page on this site, with the query added", async () => {
  expect(await returnToFor("/projects/new/hourly")).toBe("/projects/new/hourly?client=7");
  expect(await returnToFor("/projects/new/hourly?client=3")).toBe("/projects/new/hourly?client=7");
});

test("never to another site", async () => {
  for (const path of ["https://example.com/", "//example.com/", "/\\example.com/", "example.com"])
    expect(await returnToFor(path)).toBeNull();
});
