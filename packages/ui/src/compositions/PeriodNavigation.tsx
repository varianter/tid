import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { Popover } from "../primitives/Popover";
import { DetailsList, DetailsListItem } from "./DetailsList";

/** A month the picker offers. */
export type MonthChoice = {
  /** Like "October". */
  label: string;
  href: string;
  /** The month the page shows now. */
  current?: boolean;
};

/** A year the picker offers, with its months. */
export type YearChoice = {
  /** Like "2026". */
  label: string;
  /** Expanded when the picker opens. */
  open?: boolean;
  months: MonthChoice[];
};

/** One per page: its picker has a fixed id. */
export function PeriodNavigation({
  previousHref,
  nextHref,
  previousLabel,
  nextLabel,
  years,
  children,
}: PropsWithChildren<{
  previousHref: string;
  nextHref: string;
  previousLabel: string;
  nextLabel: string;
  /** The years to pick from, each with its months. Without any, the label is plain text. */
  years?: YearChoice[];
}>) {
  return (
    <nav
      composite-component="PeriodNavigation"
      class="stack-h flex-nowrap br-l p-4xs justify-between ml-auto gap-3xs"
      style="width: 30ch; min-width: max-content;"
    >
      <Button
        as="a"
        href={previousHref}
        class="aspect-square p-0"
        data-variant="outlined"
        data-size="small"
        aria-label={previousLabel}
      >
        <Icon name="chevron_left" />
      </Button>
      {years ? (
        <>
          <Button
            type="button"
            popovertarget="period-picker"
            data-variant="outlined"
            data-size="small"
            class="gap-2xs flex-1 fs-m"
          >
            <Icon class="fs-xs" name="calendar_today" />
            <span class="fw-regular">{children}</span>
          </Button>
          <Popover
            id="period-picker"
            class="my-2xs w-full"
            data-type="tooltip"
            data-side="bottom"
            data-align="right"
            style="max-width: min(var(--width-5), 90svw);"
          >
            <nav aria-label="Months" class="surface-base br-m shadow-mid">
              <DetailsList>
                {years.map((year) => (
                  <DetailsListItem title={year.label} open={year.open}>
                    <div
                      class="d-grid gap-3xs w-full"
                      style="grid-template-columns: repeat(3, 1fr);"
                    >
                      {year.months.map((month) => (
                        <a
                          href={month.href}
                          aria-current={month.current ? "page" : undefined}
                          class={`ta-center fs-s px-2xs py-2xs br-m ${
                            month.current
                              ? "surface-tinted ink-prominent"
                              : "ink-subtle bg-wash:hover"
                          }`}
                        >
                          {month.label}
                        </a>
                      ))}
                    </div>
                  </DetailsListItem>
                ))}
              </DetailsList>
            </nav>
          </Popover>
        </>
      ) : (
        <span class="stack-h flex-nowrap gap-2xs px-xs fw-medium">
          <Icon class="fs-xs" name="calendar_today" />
          <span class="fw-regular">{children}</span>
        </span>
      )}
      <Button
        as="a"
        href={nextHref}
        class="aspect-square p-0"
        data-variant="outlined"
        data-size="small"
        aria-label={nextLabel}
      >
        <Icon name="chevron_right" />
      </Button>
    </nav>
  );
}
