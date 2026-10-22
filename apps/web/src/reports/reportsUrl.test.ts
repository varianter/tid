import { expect, test } from "bun:test";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { reportUrl } from "./reportsUrl";

const roundTrip = (path: string) => {
  const query = reportUrl.read(`http://tid${path}`);
  return query && reportUrl.path(query);
};

test("a canonical report URL reads back to itself", () => {
  for (const path of [
    "/reports?company=variant-as&month=2026-09&tab=projects",
    "/reports?company=se&month=2028-02&tab=tasks&billable=yes",
    "/reports?company=se&month=2028-02&tab=consultants&billable=no",
  ]) {
    expect(roundTrip(path)).toBe(path);
  }
});

test("a sloppy report URL falls back to this month, the first tab and all hours", () => {
  const fallback = `/reports?company=se&month=${thisMonthInOslo()}&tab=projects`;
  expect(roundTrip("/reports?company=se")).toBe(fallback);
  expect(roundTrip("/reports?company=se&month=2026-13&tab=invoices&billable=")).toBe(fallback);
  expect(roundTrip("/reports?company=se&month=september&tab=Projects&billable=maybe&x=1")).toBe(
    fallback,
  );
});
