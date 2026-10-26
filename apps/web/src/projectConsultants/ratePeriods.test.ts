import { expect, test } from "bun:test";
import { ratePeriods } from "./ratePeriods";

test("ratePeriods ends each rate the day before the next and marks the one in effect", () => {
  const periods = ratePeriods(
    [
      { validFrom: "2025-01-01", rate: 153300 },
      { validFrom: "2027-01-01", rate: 170000 },
      { validFrom: "2026-01-01", rate: 158000 },
    ],
    "2026-10-05",
  );
  expect(periods).toEqual([
    { validFrom: "2027-01-01", rate: 170000, validUntil: undefined, isCurrent: false },
    { validFrom: "2026-01-01", rate: 158000, validUntil: "2026-12-31", isCurrent: true },
    { validFrom: "2025-01-01", rate: 153300, validUntil: "2025-12-31", isCurrent: false },
  ]);
});
