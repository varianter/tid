import { timeOfDayInOslo } from "@tid/calendar/osloClock";
import { Icon, type IconName, Popover } from "@tid/ui";
import { css, Style } from "hono/css";
import type { PropsWithChildren } from "hono/jsx";
import { consultantPath } from "./consultants/consultantsUrl";
import { TidSymbol, tidFaviconHref } from "./tidLogo";

export const vardeStylesheet = "https://varde.variant.dev/v/1.0.0/styles.css";

type LayoutProps = PropsWithChildren<{
  currentPath: string;
  user?: { id: number; name: string };
  isManager: boolean;
  logoutUrl: string;
  /** The bundled custom elements, loaded on every page. */
  elementsSrc: string;
}>;

type NavigationSection = {
  heading?: string;
  links: { href: string; label: string; icon: IconName }[];
};

const navigation: NavigationSection[] = [
  {
    links: [
      { href: "/timesheet", label: "Timesheet", icon: "table" },
      { href: "/reports", label: "Reports", icon: "bar_chart" },
      {
        href: "/month-close",
        label: "Month close",
        icon: "event_available",
      },
    ],
  },
  {
    heading: "Manage",
    links: [
      { href: "/projects", label: "Projects", icon: "folder" },
      { href: "/clients", label: "Clients", icon: "domain" },
    ],
  },
];

const managerNavigation: NavigationSection = {
  heading: "Admin",
  links: [
    { href: "/consultants", label: "Consultants", icon: "group" },
    { href: "/administration", label: "Administration", icon: "settings" },
  ],
};

function isActive(href: string, currentPath: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Layout({
  currentPath,
  user,
  isManager,
  logoutUrl,
  elementsSrc,
  children,
}: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href={tidFaviconHref} />
        <link rel="stylesheet" href={vardeStylesheet} />
        <script type="module" src={elementsSrc} />
        <Style />
        <Style>
          {css`
            /* Varde's display utilities would otherwise show an element marked hidden. */
            [hidden] { display: none !important; }
            /* The nav's margin is set here, next to the height calc that
               subtracts it, so the two can't drift apart. */
            #nav-popover nav { margin: var(--spacing-s); }
            @media (min-width: 900px) {
              #nav-popover { display: contents; }
              /* items-stretch on body would otherwise stretch the nav to the
                 full page height; a viewport height plus sticky keeps it a
                 sidebar that stays in view on pages taller than the screen. */
              #nav-popover nav {
                height: calc(100vh - 2 * var(--spacing-s));
                position: sticky;
                top: var(--spacing-s);
              }
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
            @view-transition {
              navigation: auto;
            }


            [data-transition="content"]{
              view-transition-name: article-content;
            }

            ::view-transition-old(root),
            ::view-transition-new(root) {
              animation: none;
              mix-blend-mode: normal;
            }

            ::view-transition-old(article-content) {
              animation: none;
              opacity: 0;
            }

            ::view-transition-group(article-content) {
              animation-duration: 0s;
            }

            ::view-transition-new(article-content) {
              animation: article-content-enter 0.6s cubic-bezier(.32, .58, .2, 1) both;
              mix-blend-mode: normal;
            }

            @keyframes article-content-enter {
              from {
                opacity: 0;
                translate: 0 40px;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              ::view-transition-new(main) {
                animation: none;
              }
            }
          `}
        </Style>
      </head>
      <body class="stack-h nowrap items-stretch">
        <Popover id="nav-popover" data-type="drawer" data-position="left">
          <nav
            class="stack-v gap-4xs b-all br-xl bc-subtle p-2xs w-max-4 w-full surface-tinted"
            aria-label="Main"
          >
            <span class="stack-h nowrap items-center gap-2xs fs-l fw-bold px-xs py-2xs mb-xs">
              <TidSymbol time={timeOfDayInOslo(new Date())} />
              Tid
            </span>
            {[...navigation, ...(isManager ? [managerNavigation] : [])].map(
              ({ heading, links }) => (
                <>
                  {heading && (
                    <span class="fs-xs tt-uppercase ink-subtle px-xs pt-s pb-4xs fw-medium">
                      {heading}
                    </span>
                  )}
                  {links.map(({ href, label, icon }) => {
                    const active = isActive(href, currentPath);
                    return (
                      <a
                        href={href}
                        aria-current={active ? "page" : undefined}
                        class={`stack-h nowrap items-center gap-xs px-xs py-2xs br-m ${active ? "surface-tinted ink-prominent" : "ink-subtle bg-wash:hover"}`}
                      >
                        <Icon name={icon} class="lh-snug fs-xs" />
                        {label}
                      </a>
                    );
                  })}
                </>
              ),
            )}
            {user && (
              <div class="stack-v mt-auto px-xs py-2xs">
                <a href={consultantPath(user.id)} class="fw-medium">
                  {user.name}
                </a>
                <a href={logoutUrl} class="fs-s ink-subtle">
                  Log out
                </a>
              </div>
            )}
          </nav>
        </Popover>
        <div class="flex-1 w-min-0">
          <button
            type="button"
            data-size="small"
            popovertarget="nav-popover"
            class="v-button menu-toggle m-s"
            aria-label="Toggle navigation menu"
          >
            <Icon name="menu" /> Menu
          </button>
          {children}
        </div>
      </body>
    </html>
  );
}
