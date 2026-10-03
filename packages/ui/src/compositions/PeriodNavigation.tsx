import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";

export function PeriodNavigation({
  previousHref,
  nextHref,
  previousLabel,
  nextLabel,
  children,
}: PropsWithChildren<{
  previousHref: string;
  nextHref: string;
  previousLabel: string;
  nextLabel: string;
}>) {
  return (
    <nav
      class="stack-h nowrap b-all bc-default br-l p-4xs justify-between"
      style="width: min(30ch, max-content);"
    >
      <Button
        as="a"
        href={previousHref}
        class="aspect-square p-0"
        data-variant="plain"
        data-size="small"
        aria-label={previousLabel}
      >
        <div class="v-icon" data-v-icon="chevron-left" />
      </Button>
      <span class="stack-h nowrap gap-2xs px-xs fw-medium">
        <CalendarIcon />
        <span class="fw-regular">{children}</span>
      </span>
      <Button
        as="a"
        href={nextHref}
        class="aspect-square p-0"
        data-variant="plain"
        data-size="small"
        aria-label={nextLabel}
      >
        <div class="v-icon" data-v-icon="chevron-right" />
      </Button>
    </nav>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
