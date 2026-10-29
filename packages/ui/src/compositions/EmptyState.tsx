import type { Child, PropsWithChildren } from "hono/jsx";

type EmptyStateProps = PropsWithChildren<{ emoji: string; title: string; action?: Child }>;

/** What a page shows when its main content is empty. Inside a `Section`, say so in a sentence instead. */
export function EmptyState({ emoji, title, action, children }: EmptyStateProps) {
  return (
    <div
      composite-component="EmptyState"
      class="surface-tinted b-all bc-subtle br-xl p-xl stack-v items-center w-max-6 mx-auto"
    >
      <span class="fs-2xl" aria-hidden="true">
        {emoji}
      </span>
      <h2 class="fs-l fw-bold mt-m">{title}</h2>
      {children && <p class="fs-s ink-subtle ta-center mt-2xs">{children}</p>}
      {action && <div class="mt-m">{action}</div>}
    </div>
  );
}
