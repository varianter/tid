import { expect, test } from "bun:test";
import { monthsOf, shiftPeriod, togglePeriod } from "./applesaucePeriod";
import {
  amountPerConsultant,
  averageRates,
  billablePercentByMonth,
  type LoggedTime,
  summarizeOffices,
  totalOfOffices,
} from "./officeSummary";

const offices = [
  { legalName: "Oslo AS", country: "NO" as const, fullDayMinutes: 450 },
  { legalName: "Stockholm AB", country: "SE" as const, fullDayMinutes: 480 },
];

const logged = (time: Partial<LoggedTime>): LoggedTime => ({
  office: "Oslo AS",
  userId: 1,
  endsOn: null,
  month: "2026-09",
  currency: "NOK",
  hours: 10,
  billableHours: 8,
  billableBaseHours: 10,
  amount: 8000,
  ratedHours: 8,
  ...time,
});

test("an office adds up its consultants' time, counting each consultant's month once", () => {
  const totals = summarizeOffices(offices, [
    logged({}),
    logged({
      currency: "EUR",
      amount: 200,
      ratedHours: 2,
      billableHours: 2,
      hours: 2,
      billableBaseHours: 2,
    }),
    logged({ userId: 2, amount: 0, ratedHours: 0 }),
  ]);
  const oslo = totals.get("Oslo AS");
  // September 2026 has 22 Norwegian workdays of 7.5 hours, for each of the two consultants.
  expect(oslo).toMatchObject({ consultants: 2, hours: 22, capacityHours: 2 * 22 * 7.5 });
  expect(oslo && averageRates(oslo)).toEqual({ NOK: 1000, EUR: 100 });
  expect(oslo && amountPerConsultant(oslo)).toEqual({ NOK: 4000, EUR: 100 });
  expect(totals.get("Stockholm AB")).toMatchObject({ consultants: 0, hours: 0 });
});

test("the total leaves out money and weighs offices by their hours", () => {
  const totals = summarizeOffices(offices, [
    logged({}),
    logged({
      office: "Stockholm AB",
      userId: 2,
      currency: "SEK",
      billableHours: 0,
      billableBaseHours: 30,
      hours: 30,
    }),
  ]);
  const total = totalOfOffices([...totals.values()]);
  expect(total).not.toHaveProperty("amounts");
  expect(total.billableHours / total.billableBaseHours).toBe(8 / 40);
});

test("a year runs up to this month, and toggles to a month in it", () => {
  expect(monthsOf("2026", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
  expect(monthsOf("2025", "2026-03")).toHaveLength(12);
  expect(shiftPeriod("2026", -1)).toBe("2025");
  expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
  expect(togglePeriod("2026-03", "2026-10")).toBe("2026");
  expect(togglePeriod("2026", "2026-10")).toBe("2026-10");
  expect(togglePeriod("2025", "2026-10")).toBe("2025-12");
});

test("each month's billable share adds up every office", () => {
  const byMonth = billablePercentByMonth([
    logged({}),
    logged({ office: "Stockholm AB", billableHours: 2, billableBaseHours: 10 }),
    logged({ month: "2026-10", billableHours: 0, billableBaseHours: 0 }),
  ]);
  expect([...byMonth]).toEqual([
    ["2026-09", 50],
    ["2026-10", 0],
  ]);
});
