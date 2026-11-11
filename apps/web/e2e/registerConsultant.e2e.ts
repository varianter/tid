import { afterAll, expect, test } from "bun:test";
import { calendarFor } from "@tid/calendar";
import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths } from "@tid/calendar/isoDate";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { organizations, users } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { attributes } from "@tid/via/attributes";
import { eq } from "drizzle-orm";
import { administrationPath } from "../src/administration/administration.url";
import { consultantPath, consultantUrl } from "../src/consultants/consultants.url";
import { capacityMinutes } from "../src/domain/capacity/capacity";
import { registerConsultantPath } from "../src/registerConsultant/registerConsultant.url";
import { navigateAndWait, openBrowser, scrollToAndClick, waitUntil } from "./browser";
import { logInAs, managerEmail } from "./devLogin";
import { database, server } from "./runningApp";

const { view, consoleErrors } = openBrowser();
afterAll(() => view.close());

// The test finds things by what the app defines, not by markup or styling: layer attributes, form
// field names, URLs from the app's own path builders, and values in the app's own formats.
const topLayer = `[${attributes.layerUrl}]:not(:has([${attributes.layerUrl}]))`;
const topForm = `document.querySelector("${topLayer} form")`;
const pageText = async () =>
  String(await view.evaluate("document.querySelector('main')?.textContent"));
const appUrl = (path: string) => new URL(path, server.url).href;

// Next month, so the journey doesn't depend on today's date. Starting mid-month leaves workdays
// before the first day, which capacity has to skip.
const nextMonth = addMonths(thisMonthInOslo(), 1);
const firstDay = calendarFor("NO")
  .workdaysIn(nextMonth)
  .find((day) => day >= `${nextMonth}-10`);
const runId = Date.now();
const email = `e2e-${runId}@variant.no`;
const name = `E2E Newcomer ${runId}`;

async function organizationOf(email: string) {
  const [organization] = await database
    .select({ country: organizations.country, fullDayMinutes: organizations.fullDayMinutes })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.email, email));
  if (!organization) throw new Error(`No user with the email ${email}`);
  return organization;
}

test("someone registered ahead is expected to work from their first day, and skips sign-up", async () => {
  if (!firstDay) throw new Error(`${nextMonth} has no workday from the 10th`);

  await logInAs(view, managerEmail);
  await navigateAndWait(view, appUrl(administrationPath));
  await scrollToAndClick(view, `a[${attributes.layer}][href="${registerConsultantPath}"]`);
  await waitUntil("the register form in a layer", () =>
    view.evaluate(`!!${topForm}?.elements.firstDay`),
  );
  await view.evaluate(`(() => {
    const form = ${topForm};
    form.elements.name.value = ${JSON.stringify(name)};
    form.elements.email.value = ${JSON.stringify(email)};
    form.elements.firstDay.value = ${JSON.stringify(firstDay)};
  })()`);
  await scrollToAndClick(view, `${topLayer} button[type=submit]`);

  const { userId } = await waitUntil("the consultant's page", () => consultantUrl.read(view.url));
  await waitUntil("their name and first day", async () => {
    const text = await pageText();
    return text.includes(name) && text.includes(formatDate(firstDay));
  });

  // Their first month's capacity starts on their first day.
  const { country, fullDayMinutes } = await organizationOf(email);
  const fromFirstDay = capacityMinutes(nextMonth, country, fullDayMinutes, { firstDay });
  const wholeMonth = capacityMinutes(nextMonth, country, fullDayMinutes);
  // Guards the test itself: if they were equal, ignoring the first day would pass too.
  expect(fromFirstDay).toBeLessThan(wholeMonth);
  await navigateAndWait(view, appUrl(consultantPath(userId, nextMonth)));
  const nextMonthText = await pageText();
  expect(nextMonthText).toContain(formatTotalHours(fromFirstDay));
  expect(nextMonthText).not.toContain(formatTotalHours(wholeMonth));

  // They log straight in to their timesheet, without signing up.
  await logInAs(view, email);

  expect(consoleErrors).toEqual([]);
});
