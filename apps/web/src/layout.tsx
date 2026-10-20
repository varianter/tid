import { css, Style } from "hono/css";
import type { PropsWithChildren } from "hono/jsx";

export const vardeStylesheet = "https://varde.variant.dev/v/1.0.0/styles.css";

type LayoutProps = PropsWithChildren<{
  title: string;
  currentPath: string;
  user?: { id: number; name: string };
  logoutUrl: string;
  /** The bundled custom elements, loaded on every page. */
  elementsSrc: string;
}>;

const navigation = [
  { href: "/timesheet", label: "Timesheet" },
  { href: "/clients", label: "Clients" },
  { href: "/projects", label: "Projects" },
  { href: "/reports", label: "Reports" },
  { href: "/end-of-the-month", label: "End of the month" },
  { href: "/users", label: "Users" },
];

function isActive(href: string, currentPath: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Layout({
  title,
  currentPath,
  user,
  logoutUrl,
  elementsSrc,
  children,
}: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href={vardeStylesheet} />
        <script type="module" src={elementsSrc} />
        <Style />
        <Style>
          {css`
            /* Varde's display utilities would otherwise show an element marked hidden. */
            [hidden] { display: none !important; }
            @media (min-width: 900px) {
              #nav-popover { display: contents; }
              .menu-toggle { display: none; }
            }
            :root{
              --vw-min: 320;
              --vw-max: 1240;
              --base-min: 1.15;
              --base-max: 1.15;
              --ratio-min: 1.2;
              --ratio-max: 1.2;
            }
          `}
        </Style>
      </head>
      <body class="stack-h nowrap items-stretch">
        <div
          id="nav-popover"
          data-type="drawer"
          data-position="left"
          popover="auto"
          class="v-popover"
        >
          <nav
            class="stack-v gap-4xs b-all m-s br-xl bc-subtle p-2xs w-max-4 w-full surface-tinted"
            aria-label="Main"
          >
            <span class="fs-l fw-bold px-xs py-2xs mb-xs">Tid</span>
            {navigation.map(({ href, label }) => {
              const active = isActive(href, currentPath);
              return (
                <a
                  href={href}
                  aria-current={active ? "page" : undefined}
                  class={`px-xs py-2xs br-m ${active ? "surface-tinted fw-medium" : "ink-subtle bg-wash:hover"}`}
                >
                  {label}
                </a>
              );
            })}
            {user && (
              <div class="stack-v mt-auto px-xs py-2xs">
                <a href={`/users/${user.id}`} class="fw-medium">
                  {user.name}
                </a>
                <a href={logoutUrl} class="fs-s ink-subtle">
                  Log out
                </a>
              </div>
            )}
          </nav>
        </div>
        <div class="flex-1 w-min-0">
          <button
            type="button"
            data-size="small"
            popovertarget="nav-popover"
            class="v-button menu-toggle m-s"
            aria-label="Toggle navigation menu"
          >
            <span aria-hidden="true">☰</span> Menu
          </button>
          {children}
        </div>
      </body>
    </html>
  );
}
