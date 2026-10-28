import { expect, test } from "bun:test";
import { type LoadFacts, outcomeOfLoad } from "./loadOutcome";

const at = (path: string) => new URL(path, "https://tid.test");
const rates = at("/projects/1/consultants/rates");
const reprice = at("/projects/1/consultants/4/rates/reprice");

const facts = (overrides: Partial<LoadFacts>): LoadFacts => ({
  url: reprice,
  shownUrl: null,
  belowUrl: rates,
  closed: false,
  leavesLayer: false,
  ...overrides,
});

test("a layer's first page shows in it", () => {
  expect(outcomeOfLoad(facts({}))).toBe("stay");
});

test("a layer closed while it loaded ignores what it loaded", () => {
  expect(outcomeOfLoad(facts({ shownUrl: at("/form"), closed: true }))).toBe("ignore");
});

test("a failed submission stays in its layer", () => {
  expect(outcomeOfLoad(facts({ shownUrl: reprice }))).toBe("stay");
  expect(outcomeOfLoad(facts({ shownUrl: reprice, leavesLayer: true }))).toBe("stay");
});

test("a form that leaves its layer loads the page it ends on as the whole page", () => {
  expect(outcomeOfLoad(facts({ shownUrl: at("/form"), leavesLayer: true }))).toBe("reload");
});

test("a step to another page opens the next layer", () => {
  expect(outcomeOfLoad(facts({ shownUrl: at("/form") }))).toBe("openNext");
});

test("a layer that arrives back where the layer below is is accepted", () => {
  expect(outcomeOfLoad(facts({ shownUrl: at("/form"), url: rates }))).toBe("accept");
});

test("a query added on the way back doesn't stop a layer from being accepted", () => {
  const month = at("/timesheet/month/2026-10");
  const withWeekends = at("/timesheet/month/2026-10?weekends=on");
  expect(outcomeOfLoad(facts({ shownUrl: at("/form"), url: withWeekends, belowUrl: month }))).toBe(
    "accept",
  );
});

test("a step that adds a query to another page isn't accepted", () => {
  const nextStep = at("/projects/1/consultants/4/rates/reprice?rate=1");
  expect(outcomeOfLoad(facts({ shownUrl: at("/form"), url: nextStep }))).toBe("openNext");
});
