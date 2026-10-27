import { afterAll, expect, test } from "bun:test";
import { openBrowser } from "./browser";
import { logInAs, managerEmail } from "./devLogin";
import { server } from "./runningApp";

const { view, consoleErrors } = openBrowser();
afterAll(() => view.close());

// An error page has a heading too, so each page is told apart by its own title. Some titles
// continue with the organization.
const pages = [
  { path: "/timesheet", heading: "Timesheet" },
  { path: "/clients", heading: "Clients" },
  { path: "/projects", heading: "Projects" },
  { path: "/reports", heading: "Reports" },
  { path: "/month-close", heading: "Month close" },
  { path: "/consultants", heading: "Consultants" },
  { path: "/office-summary", heading: "Office summary" },
  { path: "/administration", heading: "Administration of" },
];

test("a manager can open every page without a script error", async () => {
  await logInAs(view, managerEmail);
  for (const { path, heading } of pages) {
    await view.navigate(`${server.url}${path.slice(1)}`);
    const actual = await view.evaluate("document.querySelector('h1')?.textContent");
    expect(`${path}: ${actual}`).toStartWith(`${path}: ${heading}`);
  }
  expect(consoleErrors).toEqual([]);
}, 30_000);
