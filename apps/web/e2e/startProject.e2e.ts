import { afterAll, expect, test } from "bun:test";
import { attributes } from "@tid/via/attributes";
import { openBrowser, waitUntil } from "./browser";
import { logInAs, managerEmail } from "./devLogin";
import { server } from "./runningApp";

const { view, consoleErrors } = openBrowser();
afterAll(() => view.close());

const projectsUrl = `${server.url}projects`;
const layerCount = () =>
  view.evaluate(`document.querySelectorAll("[${attributes.layerUrl}]").length`);
// A nested layer sits inside the one that opened it, so the last is the one on top.
const topLayer = `[${attributes.layerUrl}]:not(:has([${attributes.layerUrl}]))`;
const topHeading = () => view.evaluate(`document.querySelector("${topLayer} h1")?.textContent`);
const sameDocument = () => view.evaluate("window.sameDocument === true");

/**
 * The projects page, through the billing choice, to the hourly project form in a drawer. Returns
 * the page's URL, which the projects page redirects to with its organization.
 */
async function openHourlyProjectForm() {
  await view.navigate(projectsUrl);
  // `url` can lag behind the redirect, still naming the page before.
  const pageUrl = await waitUntil("the projects page", () =>
    view.url.startsWith(projectsUrl) ? view.url : undefined,
  );
  // Gone after a page load, so it shows the page stayed.
  await view.evaluate("window.sameDocument = true");
  await view.click(`a[${attributes.layer}][href="/projects/new"]`);
  await waitUntil("the billing choice in a layer", async () =>
    String(await topHeading()).startsWith("New project"),
  );
  await view.click(`${topLayer} a[href*="/projects/new/hourly"]`);
  await waitUntil("the project form in a layer", async () =>
    String(await topHeading()).startsWith("New hourly project"),
  );
  // The billing choice is removed once it has finished closing.
  await waitUntil("the billing choice to close", async () => (await layerCount()) === 1);
  return pageUrl;
}

/** Fills the project form in the top layer, leaving the client and organization chosen. */
async function fillProjectForm(name: string) {
  await view.evaluate(`(() => {
    const form = document.querySelector("${topLayer} form");
    const firstOf = (select) => select.value || select.options[1].value;
    form.elements.clientId.value = firstOf(form.elements.clientId);
    form.elements.contractOwnerId.value = firstOf(form.elements.contractOwnerId);
    const currency = form.querySelector("input[name=currency][type=radio]");
    if (currency) currency.checked = true;
    form.elements.name.value = ${JSON.stringify(name)};
    form.elements.code.value = ${JSON.stringify(name.slice(-16))};
  })()`);
}

test("a project that fails to start shows its errors in its layer", async () => {
  await logInAs(view, managerEmail);
  const pageUrl = await openHourlyProjectForm();
  await fillProjectForm(`E2E failing ${Date.now()}`);
  // Skips the browser's own checks, so the server is the one that refuses.
  await view.evaluate(`(() => {
    const form = document.querySelector("${topLayer} form");
    form.noValidate = true;
    form.elements.name.value = "";
  })()`);
  await view.click(`${topLayer} button[type=submit]`);
  await waitUntil("the error in the layer", async () =>
    String(await view.evaluate(`document.querySelector("${topLayer}")?.textContent`)).includes(
      "Enter a name",
    ),
  );
  expect(await layerCount()).toBe(1);
  expect(view.url).toBe(pageUrl);
  expect(await sameDocument()).toBe(true);
}, 30_000);

test("a started project leaves its layer for the project's own page", async () => {
  await logInAs(view, managerEmail);
  await openHourlyProjectForm();
  const name = `E2E started ${Date.now()}`;
  await fillProjectForm(name);
  await view.click(`${topLayer} button[type=submit]`);
  await waitUntil("the project's page", () => /\/projects\/\d+$/.test(view.url));
  await waitUntil(
    "the page to load",
    async () => (await view.evaluate("document.readyState")) === "complete",
  );
  expect(await layerCount()).toBe(0);
  expect((await view.evaluate("document.querySelector('main h1')?.textContent")) as string).toBe(
    name,
  );
  expect(consoleErrors).toEqual([]);
}, 30_000);

test("a client added from the project form comes back to it, chosen", async () => {
  await logInAs(view, managerEmail);
  const pageUrl = await openHourlyProjectForm();
  await view.click(`${topLayer} a[href*="/clients/new"]`);
  await waitUntil("the client form on top", async () => (await topHeading()) === "New client");
  expect(await layerCount()).toBe(2);

  const client = `E2E client ${Date.now()}`;
  await view.evaluate(
    `document.querySelector("${topLayer} form").elements.name.value = ${JSON.stringify(client)}`,
  );
  await view.click(`${topLayer} button[type=submit]`);
  await waitUntil("the client form to close", async () => (await layerCount()) === 1);
  await waitUntil(
    "the project form with the client chosen",
    async () =>
      (await view.evaluate(`(() => {
      const select = document.querySelector("${topLayer} select[name=clientId]");
      return select?.selectedOptions[0]?.textContent;
    })()`)) === client,
  );
  expect(await topHeading()).toBe("New hourly project");
  expect(view.url).toBe(pageUrl);
  expect(await sameDocument()).toBe(true);
}, 30_000);

test("cancelling the client form closes it, keeping what was typed in the project form", async () => {
  await logInAs(view, managerEmail);
  const pageUrl = await openHourlyProjectForm();
  await view.evaluate(`document.querySelector("${topLayer} form").elements.name.value = "Typed"`);
  await view.click(`${topLayer} a[href*="/clients/new"]`);
  await waitUntil("the client form on top", async () => (await topHeading()) === "New client");

  await view.evaluate(
    `[...document.querySelectorAll("${topLayer} a")].find((link) => link.textContent === "Cancel").click()`,
  );
  await waitUntil("the client form to close", async () => (await layerCount()) === 1);
  expect(await topHeading()).toBe("New hourly project");
  expect(
    (await view.evaluate(
      `document.querySelector("${topLayer} form").elements.name.value`,
    )) as string,
  ).toBe("Typed");
  expect(view.url).toBe(pageUrl);
  expect(await sameDocument()).toBe(true);
}, 30_000);
