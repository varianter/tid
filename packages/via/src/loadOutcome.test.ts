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
  submitted: false,
  landedOnForm: false,
  ...overrides,
});
const submission = { submitted: true, landedOnForm: true };

test("a layer's first page shows in it", () => {
  expect(outcomeOfLoad(facts({}))).toBe("stay");
});

test("a layer closed while it loaded ignores what it loaded", () => {
  expect(outcomeOfLoad(facts({ shownUrl: at("/form"), closed: true }))).toBe("ignore");
});

test("a failed submission stays in its layer", () => {
  expect(outcomeOfLoad(facts({ ...submission, shownUrl: reprice }))).toBe("stay");
});

test("a submission saved back to its own page stays in its layer", () => {
  const saved = at("/projects/1/consultants/4/rates/reprice?saved");
  expect(outcomeOfLoad(facts({ ...submission, shownUrl: reprice, url: saved }))).toBe("stay");
});

test("a submission that ends on a page to read loads it as the whole page", () => {
  const project = at("/projects/2");
  expect(
    outcomeOfLoad(facts({ submitted: true, shownUrl: at("/projects/new"), url: project })),
  ).toBe("reload");
});

test("a submission that ends on another form opens it as the next step", () => {
  expect(outcomeOfLoad(facts({ ...submission, shownUrl: at("/form") }))).toBe("openNext");
});

test("a link to a page to read opens the next layer", () => {
  expect(outcomeOfLoad(facts({ shownUrl: at("/form") }))).toBe("openNext");
});

test("a layer that arrives back where the layer below is is accepted", () => {
  expect(outcomeOfLoad(facts({ shownUrl: at("/form"), url: rates }))).toBe("accept");
});

test("a submission that arrives back on the page to read below is accepted", () => {
  expect(outcomeOfLoad(facts({ submitted: true, shownUrl: at("/form"), url: rates }))).toBe(
    "accept",
  );
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
