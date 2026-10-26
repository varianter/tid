import { css, cx } from "hono/css";
import type { Child, PropsWithChildren } from "hono/jsx";

const container = css`
  container-type: inline-size;
`;

// The sidebar comes first in the markup so it stays on top when stacked, and moves to the right
// when there's room for both.
const columns = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "sidebar" "content";
  align-items: start;
  @container (min-width: 60rem) {
    grid-template-columns: minmax(0, 1fr) 22rem;
    grid-template-areas: "content sidebar";
  }
`;

const sidebarArea = css`
  grid-area: sidebar;
`;

const contentArea = css`
  grid-area: content;
`;

type SidebarLayoutProps = PropsWithChildren<{
  /** A fixed-width column beside the children, such as a summary. Above them when space is short. */
  sidebar: Child;
}>;

/** A fixed-width sidebar next to content that takes the rest of the width. */
export function SidebarLayout({ sidebar, children }: SidebarLayoutProps) {
  return (
    <div custom-component="SidebarLayout" class={container}>
      <div class={cx(columns, "gap-l")}>
        <div class={sidebarArea}>{sidebar}</div>
        <div class={contentArea}>{children}</div>
      </div>
    </div>
  );
}
