import { expect, test } from "bun:test";
import { Hono } from "hono";
import { flashLeftBy } from "../testing/flash";
import { setFlash, takeFlash } from "./flash";

const flash = { title: "Task added", message: "Added Design & review; 50%" };

const app = new Hono()
  .post("/", (c) => {
    setFlash(c, flash);
    return c.redirect("/", 303);
  })
  .get("/", (c) => c.json(takeFlash(c) ?? null));

test("a redirect leaves its message for the next page, word for word", async () => {
  expect(await flashLeftBy(await app.request("/", { method: "POST" }))).toEqual(flash);
});

test("the page that takes the message clears it, so it shows once", async () => {
  const redirect = await app.request("/", { method: "POST" });
  const cookie = redirect.headers.getSetCookie()[0]?.split(";")[0] ?? "";
  const page = await app.request("/", { headers: { Cookie: cookie } });
  expect(await page.json()).toEqual(flash);
  expect(page.headers.getSetCookie()).toEqual([expect.stringMatching(/^flash=; Max-Age=0/)]);
});

test("a page with no message left clears nothing", async () => {
  expect((await app.request("/")).headers.getSetCookie()).toEqual([]);
});

test("a message the app didn't write shows nothing, and is cleared", async () => {
  const page = await app.request("/", { headers: { Cookie: "flash=Added%20Design" } });
  expect(await page.json()).toBeNull();
  expect(page.headers.getSetCookie()).toEqual([expect.stringMatching(/^flash=; Max-Age=0/)]);
});
