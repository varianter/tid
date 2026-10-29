import { afterAll, expect, test } from "bun:test";
import { openBrowser, scrollToAndClick, waitUntil } from "./browser";
import { employeeEmail, logInAs } from "./devLogin";
import { findEmptyCell } from "./timesheetGrid";

const { view, consoleErrors } = openBrowser();
afterAll(() => view.close());

test("A in a cell opens the task picker", async () => {
  await logInAs(view, employeeEmail);
  const { input } = await findEmptyCell(view);

  await scrollToAndClick(view, input);
  await view.press("a");

  await waitUntil("the task picker to open", () =>
    view.evaluate(`document.querySelector('select[name="add"]').matches(":open")`),
  );
  const typed = (await view.evaluate(
    `document.querySelector(${JSON.stringify(input)}).value`,
  )) as string;
  expect(typed).toBe("");
  expect(consoleErrors).toEqual([]);
});
