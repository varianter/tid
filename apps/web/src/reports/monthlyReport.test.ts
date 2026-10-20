import { expect, test } from "bun:test";
import { formatAmounts } from "../amount/amount";
import { mergeCurrencies } from "./monthlyReport.query";

const row = (name: string, currency: string, amount: number) => ({
  name,
  currency,
  amount,
  hours: 2,
  billableHours: 1,
  unratedHours: 0,
});

test("rows that differ only by currency merge, keeping one amount per currency", () => {
  const merged = mergeCurrencies([
    row("Kari", "NOK", 1000),
    row("Kari", "EUR", 100),
    row("Ola", "NOK", 0),
  ]);

  expect(merged).toEqual([
    { name: "Kari", hours: 4, billableHours: 2, unratedHours: 0, amounts: { NOK: 1000, EUR: 100 } },
    { name: "Ola", hours: 2, billableHours: 1, unratedHours: 0, amounts: {} },
  ]);
  expect(formatAmounts({ NOK: 1000, EUR: 100 }, "NOK")).toBe(
    `${formatAmounts({ EUR: 100 }, "NOK")} · ${formatAmounts({ NOK: 1000 }, "NOK")}`,
  );
  expect(formatAmounts({}, "SEK")).toContain("0");
});
