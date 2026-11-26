type Rate = { validFrom: Temporal.PlainDate; rate: number };

// A rate lasts until the day before the next one starts. Entries before the
// earliest rate get none, so it has no "all prior" like Harvest.
export function ratePeriods(rates: Rate[], today: Temporal.PlainDate) {
  const newestFirst = rates.toSorted((a, b) =>
    Temporal.PlainDate.compare(b.validFrom, a.validFrom),
  );
  const currentIndex = newestFirst.findIndex(
    (rate) => Temporal.PlainDate.compare(rate.validFrom, today) <= 0,
  );
  return newestFirst.map((rate, index) => {
    const next = newestFirst[index - 1];
    return {
      ...rate,
      validUntil: next ? next.validFrom.subtract({ days: 1 }) : undefined,
      isCurrent: index === currentIndex,
    };
  });
}
