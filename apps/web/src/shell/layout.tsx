import { thisMonthInOslo, timeOfDayInOslo } from "@tid/calendar/osloClock";
import { Button, Icon, type IconName, Popover } from "@tid/ui";
import { css, Style } from "hono/css";
import { raw } from "hono/html";
import type { PropsWithChildren } from "hono/jsx";
import { administrationPath } from "../administration/administration.url";
import { consultantPath, consultantsPath } from "../consultants/consultants.url";
import type { User } from "../domain/users/user";
import { officeSummaryUrl } from "../officeSummary/officeSummary.url";
import { projectsPath } from "../projects/projects.url";
import { reportUrl } from "../reports/reports.url";
import { monthPath } from "../timesheet/timesheet.url";
import { TidSymbol, tidFaviconHref } from "./tidLogo";

export const vardeStylesheet = "https://varde.variant.dev/v/2.0.1/styles.css";

// Sets the scheme even without a saved one, so <theme-toggle> knows which way to flip.
const themeScript = `
  const saved = document.cookie.match(/(?:^|;\\s*)theme=(dark|light)\\b/)?.[1];
  document.documentElement.dataset.colorScheme =
    saved ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
`;

/** Lets the content security policy allow the theme script, and no other inline one. */
export const themeScriptSource = `'sha256-${new Bun.CryptoHasher("sha256").update(themeScript).digest("base64")}'`;

type LayoutProps = PropsWithChildren<{
  currentPath: string;
  user?: User;
  logoutUrl: string;
  /** The bundled custom elements, loaded on every page. */
  elementsSrc: string;
}>;

type NavigationSection = {
  heading?: string;
  /** `section` marks the link current; `href` is where it goes, when not straight to `section`. */
  links: { section: string; href?: string; label: string; icon: IconName }[];
};

// Each link goes straight to its page's canonical URL, which a bare section path redirects to.
// Month close picks its month from the database, so it keeps the redirect.
function navigationFor(user: User | undefined): NavigationSection[] {
  const month = thisMonthInOslo();
  const organization = user?.organization.slug;
  const sections: NavigationSection[] = [
    {
      links: [
        { section: "/timesheet", href: monthPath(month, false), label: "Timesheet", icon: "table" },
        {
          section: "/reports",
          href:
            organization &&
            reportUrl.path({ organization, month, tab: "projects", billable: undefined }),
          label: "Reports",
          icon: "bar_chart",
        },
        { section: "/month-close", label: "Month close", icon: "event_available" },
      ],
    },
    {
      heading: "Manage",
      links: [
        {
          section: "/projects",
          href: organization && projectsPath(organization),
          label: "Projects",
          icon: "folder",
        },
        { section: "/clients", label: "Clients", icon: "domain" },
      ],
    },
  ];
  if (!user?.isManager) return sections;
  return [
    ...sections,
    {
      heading: "Admin",
      links: [
        {
          section: "/office-summary",
          href: officeSummaryUrl.path({ period: month }),
          label: "Office summary",
          icon: "bar_chart",
        },
        {
          section: "/consultants",
          href: organization && consultantsPath(organization),
          label: "Consultants",
          icon: "group",
        },
        {
          section: "/administration",
          href: organization && administrationPath(organization),
          label: "Administration",
          icon: "settings",
        },
      ],
    },
  ];
}

function isActive(section: string, currentPath: string) {
  return currentPath === section || currentPath.startsWith(`${section}/`);
}

export function Layout({ currentPath, user, logoutUrl, elementsSrc, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Inline and blocking, so a saved theme applies before the first paint. */}
        <script>{raw(themeScript)}</script>
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
            #nav-popover nav {
              margin: var(--spacing-2xs);
              --fade-color: var(--surface-tinted);
              background: linear-gradient(100deg in oklch, var(--fade-color), oklch(from var(--fade-color) l c h / 0.9) 20%, oklch(from var(--fade-color) l c h / 0.65) 40%, oklch(from var(--fade-color) l c h / 0.35) 60%, oklch(from var(--fade-color) l c h / 0.05) 80%, oklch(from var(--fade-color) l c h / 0));
            }
            @media (min-width: 900px) {
              #nav-popover { display: contents; }
              /* items-stretch on body would otherwise stretch the nav to the
                 full page height; a viewport height plus sticky keeps it a
                 sidebar that stays in view on pages taller than the screen. */
              #nav-popover nav {
                height: calc(100vh - 2 * var(--spacing-2xs));
                position: sticky;
                top: var(--spacing-2xs);
              }
              .menu-toggle { display: none; }
            }
            theme-toggle .v-icon {
              transition: opacity var(--interaction-transition-duration-enter) var(--interaction-transition-easing-entrance), rotate var(--interaction-transition-duration-enter) var(--interaction-transition-easing-entrance), scale var(--interaction-transition-duration-enter) var(--interaction-transition-easing-entrance);
            }
            [data-color-scheme="light"] theme-toggle [data-scheme="light"],
            [data-color-scheme="dark"] theme-toggle [data-scheme="dark"] {
              opacity: 0;
              scale: 0.5;
              rotate: -90deg;
              pointer-events: none;
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
              view-transition-name: content;
            }

            ::view-transition-old(root),
            ::view-transition-new(root) {
              animation: none;
              mix-blend-mode: normal;
            }

            ::view-transition-old(content) {
              animation: none;
              opacity: 0;
            }

            ::view-transition-group(content) {
              animation-duration: 0s;
            }

            ::view-transition-new(content) {
              animation: content-enter 0.6s cubic-bezier(.32, .58, .2, 1) both;
              mix-blend-mode: normal;
            }

            @keyframes content-enter {
              from {
                opacity: 0;
                translate: 0 40px;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              ::view-transition-new(content) {
                animation: none;
              }
            }
          `}
        </Style>
      </head>
      <body class="stack-h nowrap items-stretch">
        <Popover id="nav-popover" data-type="drawer" data-side="left">
          <nav
            class="stack-v gap-4xs b-all br-xl bc-subtle p-2xs w-max-content w-full surface-tinted"
            style="min-width: 200px;"
            aria-label="Main"
          >
            <span class="stack-h nowrap items-center gap-2xs fs-l fw-bold px-xs py-2xs mb-xs">
              <TidSymbol time={timeOfDayInOslo(new Date())} />
            </span>
            {navigationFor(user).map(({ heading, links }) => (
              <>
                {heading && (
                  <span class="fs-xs  ink-subtle px-xs pt-s pb-4xs fw-medium">{heading}</span>
                )}
                {links.map(({ section, href, label, icon }) => {
                  const active = isActive(section, currentPath);
                  return (
                    <a
                      href={href ?? section}
                      aria-current={active ? "page" : undefined}
                      class={`stack-h nowrap items-center gap-xs px-xs py-2xs br-m ${active ? "surface-tinted ink-prominent" : "ink-subtle bg-wash:hover"}`}
                    >
                      <Icon name={icon} class="lh-snug fs-xs" />
                      <p class="fs-s">{label}</p>
                    </a>
                  );
                })}
              </>
            ))}
            {user && (
              <div class="stack-v mt-auto px-xs py-2xs">
                <a href={consultantPath(user.id)} class="fw-medium">
                  {user.name}
                </a>
                <a href={logoutUrl} class="fs-s ink-subtle">
                  Log out
                </a>
                <theme-toggle class="mt-xs w-full">
                  <Button
                    type="button"
                    class="pile w-full"
                    data-variant="outlined"
                    data-size="small"
                    aria-label="Toggle between light and dark color scheme"
                  >
                    <Icon name="dark_mode" data-scheme="dark" />
                    <Icon name="light_mode" data-scheme="light" />
                  </Button>
                </theme-toggle>
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
