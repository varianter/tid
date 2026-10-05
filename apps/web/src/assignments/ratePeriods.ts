import { addDays } from "../dates/dates";

type Rate = { validFrom: string; rate: number };

// A rate lasts until the day before the next one starts. Entries before the
// earliest rate get none, so it has no "all prior" like Harvest.
export function ratePeriods(rates: Rate[], today: string) {
  const newestFirst = rates.toSorted((a, b) => b.validFrom.localeCompare(a.validFrom));
  const currentIndex = newestFirst.findIndex((rate) => rate.validFrom <= today);
  return newestFirst.map((rate, index) => {
    const next = newestFirst[index - 1];
    return {
      ...rate,
      validUntil: next ? addDays(next.validFrom, -1) : undefined,
      isCurrent: index === currentIndex,
    };
  });
}
