import { expect, test } from "bun:test";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { reportUrl } from "./reports.url";

const roundTrip = (path: string) => {
  const query = reportUrl.read(`http://tid${path}`);
  return query && reportUrl.path(query);
};

test("a canonical report URL reads back to itself", () => {
  for (const path of [
    "/reports?organization=variant-as&month=2026-09&tab=projects",
    "/reports?organization=se&month=2028-02&tab=tasks&billable=yes",
    "/reports?organization=se&month=2028-02&tab=consultants&billable=no",
  ]) {
    expect(roundTrip(path)).toBe(path);
  }
});

test("a sloppy report URL falls back to this month, the first tab and all hours", () => {
  const fallback = `/reports?organization=se&month=${thisMonthInOslo()}&tab=projects`;
  expect(roundTrip("/reports?organization=se")).toBe(fallback);
  expect(roundTrip("/reports?organization=se&month=2026-13&tab=invoices&billable=")).toBe(fallback);
  expect(
    roundTrip("/reports?organization=se&month=september&tab=Projects&billable=maybe&x=1"),
  ).toBe(fallback);
});
