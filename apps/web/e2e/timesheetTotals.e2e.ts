import { afterAll, expect, test } from "bun:test";
import { formatHours } from "@tid/elements/hours";
import { openBrowser, waitUntil } from "./browser";
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

  await view.scrollTo(input, { block: "center" });
  await view.click(input);
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
}, 30_000);
