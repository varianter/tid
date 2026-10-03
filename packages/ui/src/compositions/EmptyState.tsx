import type { Child, PropsWithChildren } from "hono/jsx";

type EmptyStateProps = PropsWithChildren<{ emoji: string; title: string; action?: Child }>;

export function EmptyState({ emoji, title, action, children }: EmptyStateProps) {
  return (
    <div class="surface-tinted b-all bc-subtle br-xl p-xl stack-v items-center w-max-7 mx-auto">
      <span class="fs-2xl" aria-hidden="true">
        {emoji}
      </span>
      <h2 class="fs-l fw-bold mt-m">{title}</h2>
      {children && <p class="fs-s ink-subtle ta-center mt-2xs">{children}</p>}
      {action && <div class="mt-m">{action}</div>}
    </div>
  );
}
