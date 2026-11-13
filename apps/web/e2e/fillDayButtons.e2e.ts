import { afterAll, expect, test } from "bun:test";
import { emulatePhone, openBrowser, scrollToAndTap, waitUntil } from "./browser";
import { employeeEmail, logInAs } from "./devLogin";
import { findCellOnEmptyDay } from "./timesheetGrid";

const { view, consoleErrors } = openBrowser();
afterAll(() => view.close());

test("Fill on a phone fills in the day and keeps the cell focused", async () => {
  await logInAs(view, employeeEmail);
  await emulatePhone(view);
  expect(await view.evaluate("matchMedia('(pointer: coarse) and (width < 40rem)').matches")).toBe(
    true,
  );
  const { day, input } = await findCellOnEmptyDay(view);
  const fill = input.replace(/ input\[name=hours\]$/, " [data-fill-day]");

  await scrollToAndTap(view, input);
  await waitUntil("Fill to show on the focused cell", () =>
    view.evaluate(`document.querySelector(${JSON.stringify(fill)}).checkVisibility()`),
  );
  await scrollToAndTap(view, fill);

  const typed = await waitUntil("the cell to be filled", () =>
    view.evaluate(`document.querySelector(${JSON.stringify(input)}).value`),
  );
  expect(typed).toBe("7,5");
  expect(
    await view.evaluate(
      `document.activeElement === document.querySelector(${JSON.stringify(input)})`,
    ),
  ).toBe(true);

  // Saved like typed hours, and before the browser closes, which would post it as the app stops.
  await view.press("Tab");
  await waitUntil("the filled cell to be saved", () =>
    view.evaluate(`document.querySelector('form[data-day="${day}"][data-minutes="450"]') !== null`),
  );
  expect(consoleErrors).toEqual([]);
});
