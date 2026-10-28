import { expect, test } from "bun:test";
import { formatAmount } from "../domain/amount/amount";
import type { OrganizationOption } from "../domain/organizations/organizationFilter";
import { buildProjectReport } from "./projectReport";

const selected = { country: "NO" } as OrganizationOption;
const project = {
  id: 1,
  code: "VAR1000",
  name: "Tid",
  billing: "hourly" as const,
  clientId: 1,
  client: "Variant",
  currency: "NOK",
};

test("a consultant's days add up to one row, and only hourly projects get an amount", () => {
  const entries = [
    { email: "a@variant.no", name: "A", day: "2026-10-01", hours: 7.5, amount: 7500 },
    { email: "a@variant.no", name: "A", day: "2026-10-02", hours: 2, amount: 2000 },
    { email: "b@variant.no", name: "B", day: "2026-10-01", hours: 1, amount: 1000 },
  ];
  const report = buildProjectReport(project, entries, "2026-10", selected);
  expect(report.consultants.map(({ name, hours }) => ({ name, hours }))).toEqual([
    { name: "A", hours: 9.5 },
    { name: "B", hours: 1 },
  ]);
  expect(report.hours).toBe(10.5);
  // The three entries' amounts add up to 10500.
  expect(report.amount).toBe(formatAmount(10500, "NOK", 2));

  const fixed = buildProjectReport(
    { ...project, billing: "fixed_fee" },
    entries,
    "2026-10",
    selected,
  );
  expect(fixed.amount).toBeUndefined();
});
