import { expect, test } from "bun:test";
import type { Company } from "../organizations/companyFilter";
import { buildProjectReport } from "./projectReport";

const company = { country: "NO" } as Company;
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
  const report = buildProjectReport(project, entries, "2026-10", company);
  expect(report.consultants.map(({ name, hours }) => ({ name, hours }))).toEqual([
    { name: "A", hours: 9.5 },
    { name: "B", hours: 1 },
  ]);
  expect(report.hours).toBe(10.5);
  expect(report.amount).toBeDefined();

  const fixed = buildProjectReport(
    { ...project, billing: "fixed_fee" },
    entries,
    "2026-10",
    company,
  );
  expect(fixed.amount).toBeUndefined();
});
