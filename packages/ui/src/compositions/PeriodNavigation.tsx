import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";

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
      style="width: 30ch; min-width: max-content;"
    >
      <Button
        as="a"
        href={previousHref}
        class="aspect-square p-0"
        data-variant="plain"
        data-size="small"
        aria-label={previousLabel}
      >
        <Icon name="chevron_left" />
      </Button>
      <span class="stack-h nowrap gap-2xs px-xs fw-medium">
        <Icon class="fs-xs" name="calendar_today" />
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
        <Icon name="chevron_right" />
      </Button>
    </nav>
  );
}
