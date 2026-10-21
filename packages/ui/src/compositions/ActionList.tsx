import type { Child, PropsWithChildren } from "hono/jsx";

/** A bordered list of rows that each offer one action. Put `ActionListItem`s inside. */
export function ActionList({ children }: PropsWithChildren) {
  return <div class="surface-base b-all bc-subtle br-l of-clip">{children}</div>;
}

type ActionListItemProps = {
  title: string;
  description?: string;
  /** A Varde icon name, shown before the title. */
  icon?: string;
  /** Shown at the right edge, e.g. a link, select or checkbox. */
  action: Child;
};

export function ActionListItem({ title, description, icon, action }: ActionListItemProps) {
  return (
    <div class="stack-h items-center gap-s px-s py-s b-b bc-subtle b-none:last-child">
      {icon && <span class="v-icon ink-subtle fs-xs" data-v-icon={icon} />}
      <div class="stack-v grow">
        <p class="fw-medium">{title}</p>
        {description && <p class="fs-s ink-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}
