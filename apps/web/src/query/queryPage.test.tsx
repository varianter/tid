import { expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { idParam, pageUrl } from "./pageUrl";
import { FilterForm, queryPage } from "./queryPage";

const shelfUrl = pageUrl(
  "/shelf",
  z.object({
    color: z.enum(["red", "blue"]).catch("red"),
    size: z.enum(["small", "large"]).optional().catch(undefined),
  }),
);

const app = new Hono().get(
  "/shelf",
  queryPage({
    url: shelfUrl,
    loader: async (c, query) => (query.size === "large" ? c.notFound() : { count: 3 }),
    view: ({ count, href }) => (
      <main>
        <a href={href({ color: "blue" })}>{count} blue</a>
        <FilterForm field="size">
          <select name="size" />
        </FilterForm>
      </main>
    ),
  }),
);

test("a sloppy query redirects to the canonical URL", async () => {
  const response = await app.request("/shelf?color=green&size=small&extra=1");
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/shelf?color=red&size=small");
});

test("links and filter forms keep the rest of the query", async () => {
  const html = await (await app.request("/shelf?color=red&size=small")).text();
  expect(html).toContain('href="/shelf?color=blue&amp;size=small"');
  expect(html).toContain('<input type="hidden" name="color" value="red"/>');
  expect(html).not.toContain('name="size" value=');
});

test("the loader can answer instead of the view", async () => {
  expect((await app.request("/shelf?color=red&size=large")).status).toBe(404);
});

const binUrl = pageUrl(
  "/shelf/:shelfId/bins/:bin",
  z.object({ shelfId: idParam, bin: z.string(), color: z.enum(["red", "blue"]).catch("red") }),
);

test("path parameters decode from the path and stay out of the query", () => {
  expect(binUrl.read("http://tid/shelf/12/bins/top?color=blue&shelfId=3")).toEqual({
    shelfId: 12,
    bin: "top",
    color: "blue",
  });
  expect(binUrl.path({ shelfId: 12, bin: "top", color: "red" })).toBe(
    "/shelf/12/bins/top?color=red",
  );
});

test("a path parameter that doesn't decode is no page", () => {
  expect(binUrl.read("http://tid/shelf/twelve/bins/top")).toBeUndefined();
  expect(binUrl.read("http://tid/shelf/12")).toBeUndefined();
});
