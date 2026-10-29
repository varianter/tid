import { afterAll, expect, test } from "bun:test";
import { formatHours } from "@tid/elements/hours";
import { openBrowser, scrollToAndClick, waitUntil } from "./browser";
import { employeeEmail, logInAs } from "./devLogin";
import { findEmptyCell } from "./timesheetGrid";

const { view } = openBrowser();
afterAll(() => view.close());

const textOf = (selector: string) =>
  view.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent`);

const minutesIn = async (cells: string) =>
  (await view.evaluate(
    `[...document.querySelectorAll(${JSON.stringify(cells)})].reduce((sum, form) => sum + Number(form.dataset.minutes), 0)`,
  )) as number;

test("saving a cell updates the totals without reloading the page", async () => {
  await logInAs(view, employeeEmail);
  const { projectId, day, input } = await findEmptyCell(view);
  const minutesBefore = await minutesIn("form[data-minutes]");
  const projectMinutesBefore = await minutesIn(`form[data-project="${projectId}"]`);
  const dayMinutesBefore = await minutesIn(`form[data-day="${day}"]`);
  // Gone after a reload, so it shows the page stayed.
  await view.evaluate("window.sameDocument = true");

  await scrollToAndClick(view, input);
  await view.type("4");
  await view.press("Enter");

  const expectedGrandTotal = formatHours(minutesBefore + 240);
  await waitUntil("the grand total to update", async () => {
    return (await textOf("[data-grand-total]")) === expectedGrandTotal;
  });
  expect(await textOf(`[data-project-total="${projectId}"]`)).toBe(
    formatHours(projectMinutesBefore + 240),
  );
  expect(await textOf(`[data-day-total="${day}"]`)).toBe(formatHours(dayMinutesBefore + 240));
  const sameDocument = await view.evaluate("window.sameDocument");
  expect(sameDocument).toBe(true);
});

test("typing in a cell updates the totals before it's saved", async () => {
  await logInAs(view, employeeEmail);
  const { input } = await findEmptyCell(view);
  const minutesBefore = await minutesIn("form[data-minutes]");

  await scrollToAndClick(view, input);
  await view.type("4");
  expect(await textOf("[data-grand-total]")).toBe(formatHours(minutesBefore + 240));

  // Not hours yet, so the cell counts what's stored.
  await view.type(",");
  expect(await textOf("[data-grand-total]")).toBe(formatHours(minutesBefore));

  // Back to what's stored, so leaving the page saves nothing into later tests.
  await view.press("Backspace");
  await view.press("Backspace");
});

test("stepping a cell's hours updates the totals before it's saved", async () => {
  await logInAs(view, employeeEmail);
  const { day, input } = await findEmptyCell(view);
  const dayTotal = `[data-day-total="${day}"]`;
  const dayMinutesBefore = await minutesIn(`form[data-day="${day}"]`);

  await scrollToAndClick(view, input);
  await view.press("ArrowUp", { modifiers: ["Shift"] });
  expect(await textOf(dayTotal)).toBe(formatHours(dayMinutesBefore + 30));

  // Back to blank, so leaving the page saves nothing into later tests.
  await view.press("ArrowDown", { modifiers: ["Shift"] });
  expect(await textOf(dayTotal)).toBe(formatHours(dayMinutesBefore));
});
