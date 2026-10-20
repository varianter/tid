import { expect, test } from "bun:test";
import type { organizations } from "@tid/db/schema";
import { listCompanies } from "./companyFilter";

type Organization = typeof organizations.$inferSelect;

const organization = (slug: string, overrides: Partial<Organization> = {}): Organization => ({
  id: slug.length,
  slug,
  name: slug,
  legalName: slug,
  country: "NO",
  currency: "NOK",
  fullDayMinutes: 450,
  ...overrides,
});

test("each country comes first as a whole, then its organizations", () => {
  const companies = listCompanies([
    organization("oslo"),
    organization("bergen"),
    organization("stockholm", { country: "SE", currency: "SEK", fullDayMinutes: 480 }),
  ]);
  expect(companies.map((company) => [company.value, company.organizations.length])).toEqual([
    ["no", 2],
    ["oslo", 1],
    ["bergen", 1],
    ["se", 1],
    ["stockholm", 1],
  ]);
  expect(companies[0]?.name).toBe("All of Norway");
  expect(companies[3]?.currency).toBe("SEK");
});

test("a country whose organizations differ in currency or length of day is refused", () => {
  expect(() =>
    listCompanies([organization("oslo"), organization("bergen", { currency: "EUR" })]),
  ).toThrow();
  expect(() =>
    listCompanies([organization("oslo"), organization("bergen", { fullDayMinutes: 480 })]),
  ).toThrow();
});

test("an organization can't take its country's value", () => {
  expect(() => listCompanies([organization("no")])).toThrow();
});
