import { afterAll, expect, test } from "bun:test";
import { timeEntries } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { openBrowser, waitUntil } from "./browser";
import { employeeEmail, logInAs } from "./devLogin";
import { database } from "./runningApp";
import { findEmptyCell } from "./timesheetGrid";

const { view } = openBrowser();
afterAll(() => view.close());

// Starting Chrome alone can take longer than Bun's default five seconds.
test("a user logs in and logs hours on the timesheet", async () => {
  await logInAs(view, employeeEmail);
  const heading = await view.evaluate("document.querySelector('h1')?.textContent");
  expect(heading).toBe("Timesheet");

  const { taskId, day, input } = await findEmptyCell(view);
  await view.click(input);
  await view.type("6,5");
  await view.press("Enter");

  const entry = await waitUntil("the entry to be stored", async () => {
    const [row] = await database
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.taskId, taskId), eq(timeEntries.spentOn, day)));
    return row;
  });
  expect(entry.minutes).toBe(390);
}, 30_000);
