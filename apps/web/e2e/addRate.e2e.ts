import { afterAll, beforeAll, expect, test } from "bun:test";
import { attributes } from "@tid/via/attributes";
import { sql } from "drizzle-orm";
import { openBrowser, waitUntil } from "./browser";
import { logInAs, managerEmail } from "./devLogin";
import { database, server } from "./runningApp";

const { view, consoleErrors } = openBrowser();
afterAll(() => view.close());

let ratesUrl: string;
let addRateLink: string;
let firstDay: string;

// Someone in the manager's organization with hours on the project. A rate from their first day
// reprices those hours, which takes the form through its confirming step.
beforeAll(async () => {
  const [assignment] = await database.execute<{
    projectId: number;
    userId: number;
    firstDay: string;
  }>(sql`
    select pa.project_id as "projectId", pa.user_id as "userId", min(te.spent_on)::text as "firstDay"
    from project_assignments pa
    join users manager on manager.email = ${managerEmail} and manager.org_id = pa.org_id
    join tasks t on t.project_id = pa.project_id
    join time_entries te on te.task_id = t.id and te.user_id = pa.user_id
    group by pa.project_id, pa.user_id
    limit 1`);
  if (!assignment) throw new Error("The fixture has no consultant with hours to reprice");
  ratesUrl = `${server.url}projects/${assignment.projectId}/consultants/rates`;
  addRateLink = `a[${attributes.layer}][href$="/${assignment.userId}/rates/new"]`;
  firstDay = assignment.firstDay;
});

const layerHeading = () => view.evaluate("document.querySelector(':popover-open h1')?.textContent");
const layerCount = () =>
  view.evaluate(`document.querySelectorAll("[${attributes.layerUrl}]").length`);
const layerType = () => view.evaluate("document.querySelector(':popover-open')?.dataset.type");

async function openAddRate() {
  await view.navigate(ratesUrl);
  // Gone after a reload, so it shows the page stayed.
  await view.evaluate("window.sameDocument = true");
  await view.scrollTo(addRateLink, { block: "center" });
  await view.click(addRateLink);
  await waitUntil("the form to open in a layer", async () =>
    String(await layerHeading()).startsWith("New rate for"),
  );
}

test("a manager adds a rate in a layer, through its repricing step, and lands back on the rates", async () => {
  await logInAs(view, managerEmail);
  await openAddRate();
  expect(view.url).toBe(ratesUrl);
  expect(await layerType()).toBe("tooltip");
  // A tooltip asks to hang below the action, lined up with its right edge. Where there's no room
  // below, it flips above, so placement is checked by the side it lands on, not by pixels.
  const placement = await view.evaluate(`(() => {
    const { side, align } = document.querySelector(":popover-open").dataset;
    return { side, align };
  })()`);
  expect(placement).toEqual({ side: "bottom", align: "right" });

  await view.evaluate(`(() => {
    const form = document.querySelector(":popover-open form");
    form.elements.rate.value = "4321";
    form.elements.validFrom.value = "${firstDay}";
  })()`);
  await view.click(":popover-open button[type=submit]");
  await waitUntil("the repricing step in the same layer", async () =>
    String(await layerHeading()).includes("from"),
  );
  // The rate form's layer is removed once it has finished closing.
  await waitUntil("one layer", async () => (await layerCount()) === 1);
  expect(await layerType()).toBe("drawer");
  // The tooltip's placement doesn't carry over, so the drawer keeps to the window's right edge
  // and runs its full height, once it has slid in.
  const drawer = await view.evaluate(`(async () => {
    const layer = document.querySelector(":popover-open");
    await Promise.allSettled(layer.getAnimations({ subtree: true }).map((animation) => animation.finished));
    const { top, right, bottom } = layer.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    return { side: layer.dataset.side ?? null, right: width - right, top, bottom: innerHeight - bottom };
  })()`);
  expect(drawer).toEqual({ side: null, right: 0, top: 0, bottom: 0 });
  await view.scrollTo(":popover-open button[type=submit]", { block: "center" });

  await view.click(":popover-open button[type=submit]");
  await waitUntil("the layer to close", async () => (await layerCount()) === 0);
  const page = (await view.evaluate("document.querySelector('main').textContent")) as string;
  // Amounts group thousands with a space, which may be a non-breaking one.
  expect(page).toMatch(/4\s321/);
  expect(view.url).toBe(ratesUrl);
  expect((await view.evaluate("window.sameDocument")) as boolean).toBe(true);
  expect(consoleErrors).toEqual([]);
}, 30_000);

test("dismissing the layer leaves the page as it was", async () => {
  await logInAs(view, managerEmail);
  await openAddRate();
  await view.press("Escape");
  await waitUntil("the layer to be removed", async () => (await layerCount()) === 0);
  expect((await view.evaluate("window.sameDocument")) as boolean).toBe(true);
}, 30_000);
