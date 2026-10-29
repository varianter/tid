import { afterAll, expect, test } from "bun:test";
import { timeEntries } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { navigateAndWait, openBrowser, scrollToAndClick, waitUntil } from "./browser";
import { employeeEmail, logInAs } from "./devLogin";
import { database, server } from "./runningApp";
import { findEmptyCell } from "./timesheetGrid";

const { view } = openBrowser();
afterAll(() => view.close());

const storedMinutes = async (taskId: number, day: string) => {
  const [row] = await database
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.taskId, taskId), eq(timeEntries.spentOn, day)));
  return row?.minutes;
};

test("a user logs in and logs hours on the timesheet", async () => {
  await logInAs(view, employeeEmail);
  const heading = await view.evaluate("document.querySelector('h1')?.textContent");
  expect(heading).toBe("Timesheet");

  const { taskId, day, input } = await findEmptyCell(view);
  await scrollToAndClick(view, input);
  await view.type("6,5");
  await view.press("Enter");

  const minutes = await waitUntil("the entry to be stored", () => storedMinutes(taskId, day));
  expect(minutes).toBe(390);
});

test("hours typed in a cell are saved when the user leaves the page from it", async () => {
  await logInAs(view, employeeEmail);
  const { taskId, day, input } = await findEmptyCell(view);
  await scrollToAndClick(view, input);
  await view.type("3");
  await navigateAndWait(view, `${server.url}dev/login`);

  const minutes = await waitUntil("the entry to be stored", () => storedMinutes(taskId, day));
  expect(minutes).toBe(180);
});
