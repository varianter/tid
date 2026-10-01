import { expect, test } from "bun:test";
import { reportQuery } from "./period";

test("reportQuery snaps any day to its whole month", () => {
  expect(String(reportQuery("2026-09-15", "projects", "2026-10-01"))).toBe(
    "view=month&from=2026-09-01&till=2026-09-30&tab=projects",
  );
  expect(String(reportQuery("2028-02-01", "clients", "2026-10-01"))).toBe(
    "view=month&from=2028-02-01&till=2028-02-29&tab=clients",
  );
});

test("reportQuery falls back to the current month and the first tab", () => {
  const fallback = "view=month&from=2026-10-01&till=2026-10-31&tab=clients";
  expect(String(reportQuery(undefined, undefined, "2026-10-01"))).toBe(fallback);
  expect(String(reportQuery("2026-02-30", "invoices", "2026-10-01"))).toBe(fallback);
  expect(String(reportQuery("september", "Clients", "2026-10-01"))).toBe(fallback);
});
