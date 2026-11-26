import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { Popover } from "../primitives/Popover";
import { DetailsList, DetailsListItem } from "./DetailsList";

/** A month or year the picker links to. */
export type PeriodChoice = {
  /** Like "October" or "2026". */
  label: string;
  href: string;
  /** The period the page shows now. */
  current?: boolean;
};

/** A year the picker offers, with its months. */
export type YearChoice = {
  /** Like "2026". */
  label: string;
  /** Expanded when the picker opens. */
  open?: boolean;
  months: PeriodChoice[];
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
  /**
   * What the picker offers: years with their months to pick a month, or plain years to pick a
   * year. Without any, the label is plain text.
   */
  years?: YearChoice[] | PeriodChoice[];
}>) {
  return (
    <nav
      composite-component="PeriodNavigation"
      class="stack-h flex-nowrap br-l p-4xs justify-between gap-3xs"
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
            <span class="fw-regular fs-s">{children}</span>
          </Button>
          <Popover
            id="period-picker"
            class="my-2xs w-full"
            data-type="tooltip"
            data-side="bottom"
            data-align="left"
            style="max-width: min(var(--width-5), 90svw);"
          >
            <nav aria-label="Periods" class="surface-base br-m shadow-mid w-max-3">
              {areYearsWithMonths(years) ? (
                <DetailsList>
                  {years.map((year) => (
                    <DetailsListItem title={year.label} open={year.open}>
                      <ChoiceGrid choices={year.months} />
                    </DetailsListItem>
                  ))}
                </DetailsList>
              ) : (
                <div class="b-all bc-subtle br-m p-s">
                  <ChoiceGrid choices={years} />
                </div>
              )}
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

const areYearsWithMonths = (years: YearChoice[] | PeriodChoice[]): years is YearChoice[] =>
  years.every((year) => "months" in year);

function ChoiceGrid({ choices }: { choices: PeriodChoice[] }) {
  return (
    <div class="d-grid gap-3xs w-full" style="grid-template-columns: repeat(3, 1fr);">
      {choices.map((choice) => (
        <a
          href={choice.href}
          aria-current={choice.current ? "page" : undefined}
          class={`ta-center fs-s px-2xs py-2xs br-m ${
            choice.current ? "surface-tinted ink-prominent" : "ink-subtle bg-wash:hover"
          }`}
        >
          {choice.label}
        </a>
      ))}
    </div>
  );
}
