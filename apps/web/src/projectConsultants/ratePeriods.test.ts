import { expect, test } from "bun:test";
import { ratePeriods } from "./ratePeriods";

test("ratePeriods ends each rate the day before the next and marks the one in effect", () => {
  const periods = ratePeriods(
    [
      { validFrom: Temporal.PlainDate.from("2025-01-01"), rate: 153300 },
      { validFrom: Temporal.PlainDate.from("2027-01-01"), rate: 170000 },
      { validFrom: Temporal.PlainDate.from("2026-01-01"), rate: 158000 },
    ],
    Temporal.PlainDate.from("2026-10-05"),
  );
  expect(periods).toEqual([
    {
      validFrom: Temporal.PlainDate.from("2027-01-01"),
      rate: 170000,
      validUntil: undefined,
      isCurrent: false,
    },
    {
      validFrom: Temporal.PlainDate.from("2026-01-01"),
      rate: 158000,
      validUntil: Temporal.PlainDate.from("2026-12-31"),
      isCurrent: true,
    },
    {
      validFrom: Temporal.PlainDate.from("2025-01-01"),
      rate: 153300,
      validUntil: Temporal.PlainDate.from("2025-12-31"),
      isCurrent: false,
    },
  ]);
});
