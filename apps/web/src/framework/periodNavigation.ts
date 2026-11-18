import { formatMonth } from "@tid/calendar/dateDisplay";
import type { PeriodChoice, YearChoice } from "@tid/ui";

/** The years around `month`, each with its months, for the picker a `PeriodNavigation` label opens. */
export function yearsAround(
  month: Temporal.PlainYearMonth,
  /** The page with its month changed, as one of the picker's links needs it. */
  href: (change: { month: Temporal.PlainYearMonth }) => string,
): YearChoice[] {
  return [-1, 0, 1].map((yearOffset) => {
    const year = month.year + yearOffset;
    return {
      label: String(year),
      open: yearOffset === 0,
      months: Array.from({ length: 12 }, (_, monthIndex) => {
        const monthOption = Temporal.PlainYearMonth.from({ year, month: monthIndex + 1 });
        return {
          label: formatMonth(monthOption, "monthName"),
          href: href({ month: monthOption }),
          current: monthOption.equals(month),
        };
      }),
    };
  });
}

/** The years around `year`, for the picker a `PeriodNavigation` label opens on a page that shows a year. */
export function yearsNear(
  year: number,
  /** The page with its year changed, as one of the picker's links needs it. */
  href: (change: { year: number }) => string,
): PeriodChoice[] {
  return [-4, -3, -2, -1, 0, 1].map((yearOffset) => {
    const yearOption = year + yearOffset;
    return {
      label: String(yearOption),
      href: href({ year: yearOption }),
      current: yearOffset === 0,
    };
  });
}
