import { afterAll, afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { attributes } from "../src/attributes";
import { server, slowSubmissions } from "./fixtureServer";

// Longer than a wait, so a stuck wait reports what it waited for.
setDefaultTimeout(15_000);

// Chrome, like the app's e2e tests, so a Mac and Linux behave the same.
const consoleErrors: string[] = [];
const view = new Bun.WebView({
  width: 1280,
  height: 800,
  backend: "chrome",
  console: (type, ...args) => {
    if (type === "error") consoleErrors.push(args.join(" "));
  },
});
afterAll(() => view.close());

// via reports a failed submission only on the console.
afterEach(() => {
  expect(consoleErrors.splice(0)).toEqual([]);
});

const layer = `[${attributes.layerUrl}]`;
const openLayer = ":popover-open";
const layerCount = () => view.evaluate(`document.querySelectorAll("${layer}").length`);
const layerHeading = () => view.evaluate(`document.querySelector("${openLayer} h1")?.textContent`);
const pageText = async () => String(await view.evaluate("document.body.textContent"));
// Gone after a page load, so it shows the page stayed.
const sameDocument = () => view.evaluate("window.sameDocument === true");

async function waitUntil(description: string, check: () => unknown) {
  const deadline = Date.now() + 5000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Gave up waiting for ${description}`);
    await Bun.sleep(50);
  }
}

async function openLayerFrom(href: string, heading: string) {
  await view.navigate(server.url.href);
  await view.evaluate("window.sameDocument = true");
  await view.click(`a[${attributes.layer}][href="${href}"]`);
  await waitUntil(`${heading} in a layer`, async () => (await layerHeading()) === heading);
}

const openForm = () => openLayerFrom("/form", "Form");

test("a layer link opens its page in a layer, without leaving the page", async () => {
  await openForm();
  expect(view.url).toBe(server.url.href);
  expect(await sameDocument()).toBe(true);
});

test("a failed submission stays in its layer", async () => {
  await openForm();
  await view.click(`${layer} button:not([formaction])`);
  await waitUntil("the error", () =>
    view.evaluate(`Boolean(document.querySelector('${layer} [aria-invalid="true"]'))`),
  );
  expect(await layerCount()).toBe(1);
  expect(await sameDocument()).toBe(true);
});

test("a submission that arrives back on the page accepts the layer and shows what it arrived on", async () => {
  await openForm();
  await view.type("A note");
  await view.click(`${layer} button:not([formaction])`);
  await waitUntil("the layer to close", async () => (await layerCount()) === 0);
  expect(await pageText()).toContain("Saved");
  expect(await sameDocument()).toBe(true);
});

test("an accepted layer gives focus back to the link that opened it", async () => {
  await openForm();
  await view.type("A note");
  await view.click(`${layer} button:not([formaction])`);
  await waitUntil("the layer to close", async () => (await layerCount()) === 0);
  const focused = await view.evaluate(`document.activeElement?.getAttribute("href")`);
  expect(focused).toBe("/form");
});

test("a step to another page opens the next layer in place of this one", async () => {
  await openForm();
  await view.click(`${layer} button[formaction$="/next"]`);
  await waitUntil("the next step", async () => (await layerHeading()) === "Step");
  await waitUntil("the form's layer to close", async () => (await layerCount()) === 1);
});

test("a nested layer that arrives back on its parent's page is accepted into the parent", async () => {
  await openForm();
  await view.click(`${layer} a[${attributes.layer}]`);
  const nestedHeading = `document.querySelector("${openLayer} ${openLayer} h1")?.textContent`;
  await waitUntil(
    "the nested layer",
    async () => (await view.evaluate(nestedHeading)) === "Nested",
  );
  await view.click(`${layer} ${layer} button`);
  await waitUntil("the nested layer to close", async () => (await layerCount()) === 1);
  expect(await layerHeading()).toBe("Form");
  const parentText = await view.evaluate(`document.querySelector("${layer}").textContent`);
  expect(String(parentText)).toContain("Added");
  expect(await sameDocument()).toBe(true);
});

test("a form that leaves its layer loads the page it ends on as the whole page", async () => {
  await openLayerFrom("/leave", "Leave");
  await view.click(`${layer} button`);
  await waitUntil("the step as the page", () => view.url.endsWith("/step"));
  expect(await layerCount()).toBe(0);
  expect(await sameDocument()).toBe(false);
});

test("pressing save again while a submission loads doesn't post it twice", async () => {
  await openForm();
  slowSubmissions.count = 0;
  const saveSlowly = `${layer} button[formaction$="/slow"]`;
  await view.click(saveSlowly);
  await view.click(saveSlowly);
  await waitUntil("the layer to close", async () => (await layerCount()) === 0);
  expect(slowSubmissions.count).toBe(1);
});

test("a dismiss link closes its layer and loads nothing", async () => {
  await openForm();
  await view.click(`${layer} a[${attributes.dismiss}]`);
  await waitUntil("the layer to close", async () => (await layerCount()) === 0);
  expect(await sameDocument()).toBe(true);
});

test("a submission answered without a page shows the response as the page", async () => {
  await openForm();
  await view.click(`${layer} button[formaction$="/proxy-error"]`);
  await waitUntil("the proxy's response", async () => (await pageText()).includes("Bad gateway"));
  const hasMain = await view.evaluate(`Boolean(document.querySelector("main"))`);
  expect(hasMain).toBe(false);
});
