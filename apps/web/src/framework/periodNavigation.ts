import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths } from "@tid/calendar/isoDate";
import type { PeriodChoice, YearChoice } from "@tid/ui";

/** The years around `month`, each with its months, for the picker a `PeriodNavigation` label opens. */
export function yearsAround(
  month: string,
  /** The page with its month changed, as one of the picker's links needs it. */
  href: (change: { month: string }) => string,
): YearChoice[] {
  return [-1, 0, 1].map((yearOffset) => {
    const year = Number(month.slice(0, 4)) + yearOffset;
    return {
      label: String(year),
      open: yearOffset === 0,
      months: Array.from({ length: 12 }, (_, monthIndex) => {
        const monthOption = addMonths(`${year}-01`, monthIndex);
        return {
          label: formatDate(monthOption, "monthName"),
          href: href({ month: monthOption }),
          current: monthOption === month,
        };
      }),
    };
  });
}

/** The years around `year`, for the picker a `PeriodNavigation` label opens on a page that shows a year. */
export function yearsNear(
  year: string,
  /** The page with its year changed, as one of the picker's links needs it. */
  href: (change: { year: string }) => string,
): PeriodChoice[] {
  return [-4, -3, -2, -1, 0, 1].map((yearOffset) => {
    const yearOption = String(Number(year) + yearOffset);
    return { label: yearOption, href: href({ year: yearOption }), current: yearOption === year };
  });
}
