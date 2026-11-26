import type { Child, PropsWithChildren } from "hono/jsx";

type EmptyStateProps = PropsWithChildren<{ title: string; action?: Child }>;

/** What a page shows when its main content is empty. Inside a `Section`, say so in a sentence instead. */
export function EmptyState({ title, action, children }: EmptyStateProps) {
  return (
    <div
      composite-component="EmptyState"
      class="surface-tinted br-xl p-xl stack-v items-center w-max-6 mx-auto"
    >
      <h2 class="fs-l fw-bold">{title}</h2>
      {children && <p class="fs-s ink-subtle ta-center mt-2xs">{children}</p>}
      {action && <div class="mt-m">{action}</div>}
    </div>
  );
}
