import { attributes } from "@tid/via/attributes";
import type { PropsWithChildren } from "hono/jsx";
import { Button } from "../../primitives/Button";

type ReturnLinkProps = PropsWithChildren<{
  /** The page this one was opened from. */
  href: string;
}>;

/** Goes back to the page this one was opened from, or closes its layer when it's in one. */
export function ReturnLink({ href, children }: ReturnLinkProps) {
  return (
    // Under a page's content it keeps its own width rather than stretching across the page.
    <Button
      as="a"
      href={href}
      data-variant="plain"
      class="self-start"
      {...{ [attributes.dismiss]: true }}
    >
      {children}
    </Button>
  );
}
