import type { Child, PropsWithChildren } from "hono/jsx";
import { Icon } from "../primitives/Icon";

/** A bordered list of collapsible sections. Put `DetailsListItem`s inside. */
export function DetailsList({ children }: PropsWithChildren) {
  return <div class="b-all bc-subtle br-m of-clip">{children}</div>;
}

type DetailsListItemProps = PropsWithChildren<{
  title: string;
  /** Shown at the right edge of the header, e.g. a count. */
  aside?: Child;
  open?: boolean;
}>;

export function DetailsListItem({ title, aside, open, children }: DetailsListItemProps) {
  return (
    <details class="b-b bc-subtle b-none:last-child" open={open}>
      <summary class="stack-h items-center gap-xs px-s py-xs bg-wash:hover">
        <Icon name="chevron_right" class="ink-subtle fs-xs" />
        <span class="fw-medium">{title}</span>
        {aside && <span class="ml-auto fs-s ink-subtle">{aside}</span>}
      </summary>
      <div class="stack-v gap-xs pl-l pr-s pt-2xs pb-s">{children}</div>
    </details>
  );
}
