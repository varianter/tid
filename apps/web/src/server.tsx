import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { findIconSvg, iconsPath } from "@tid/ui";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { jsxRenderer } from "hono/jsx-renderer";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { administration } from "./administration/administration.routes";
import { clients } from "./clients/clients.routes";
import { consultants } from "./consultants/consultants.routes";
import { dev, devLogoutUrl, devTenantId, readDevIdentity, requireDevUser } from "./dev/dev.routes";
import type { PublicEnv } from "./domain/users/user";
import { bundleBrowserScript } from "./framework/browserScript";
import { errorReport } from "./framework/errorReport";
import { reportDatabaseTiming, reportRenderTiming, timeMiddleware } from "./framework/serverTiming";
import { signupRouter } from "./login/login.routes";
import { signupPath } from "./login/login.url";
import { proxyLogoutUrl, requireProxyUser } from "./login/proxyLogin.middleware";
import { monthClose } from "./monthClose/monthClose.routes";
import { officeSummary } from "./officeSummary/officeSummary.routes";
import { projectConsultants } from "./projectConsultants/projectConsultants.routes";
import { projects } from "./projects/projects.routes";
import { reports } from "./reports/reports.routes";
import { ErrorPage } from "./shell/errorPage";
import { Layout, themeScriptSource, vardeStylesheet } from "./shell/layout";
import { timesheet } from "./timesheet/timesheet.routes";
import { monthPath } from "./timesheet/timesheet.url";

const isDevLoginEnabled = process.env.DEV_LOGIN === "true";

function chooseLogin() {
  if (isDevLoginEnabled) {
    return {
      requireUser: requireDevUser,
      logoutUrl: devLogoutUrl,
      signup: signupRouter(devTenantId, readDevIdentity),
    };
  }
  const tenantId = process.env.ENTRA_TENANT_ID;
  if (!tenantId)
    throw new Error("ENTRA_TENANT_ID is not set - please check process.env.ENTRA_TENANT_ID");
  return {
    requireUser: requireProxyUser(tenantId),
    logoutUrl: proxyLogoutUrl(tenantId),
    signup: signupRouter(tenantId),
  };
}
const login = chooseLogin();

const scripts = await Promise.all([
  bundleBrowserScript(import.meta.resolve("@tid/elements/browser")),
  bundleBrowserScript(import.meta.resolve("@tid/via/browser")),
]);

const app = new Hono<PublicEnv>();

app.use(compress(), timing({ totalDescription: "Total" }), reportDatabaseTiming);

app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", themeScriptSource],
      // Pages size grids and bars with style attributes.
      styleSrc: ["'self'", "'unsafe-inline'", "https://varde.variant.dev"],
      fontSrc: ["https://varde.variant.dev"],
      imgSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  }),
);
app.use(
  jsxRenderer(async ({ children }, c) => {
    // Early discovery of the stylesheet and scripts, before the browser reaches their tags in head.
    // The font is fetched with CORS, which needs its own connection to Varde's origin.
    c.header(
      "Link",
      [
        `<${vardeStylesheet}>; rel=preload; as=style`,
        `<${new URL(vardeStylesheet).origin}>; rel=preconnect; crossorigin`,
        ...scripts.map((script) => `<${script.path}>; rel=modulepreload`),
      ].join(", "),
    );
    const user = c.get("user");
    return (
      <Layout
        currentPath={c.req.path}
        user={user}
        logoutUrl={login.logoutUrl}
        scriptSrcs={scripts.map((script) => script.path)}
      >
        {children}
      </Layout>
    );
  }),
);
// Login is a session cookie, so form posts from other sites would otherwise be trusted. After the
// renderer, so a refused post renders as a page.
app.use(csrf());

app.use(reportRenderTiming);

app.notFound((c) => {
  c.status(404);
  return c.render(<ErrorPage status={404} message="Page not found" />);
});

app.onError((error, c) => {
  // Routes throw these to refuse a request, and Hono throws them itself when the CSRF check fails.
  // A page rather than plain text, so a form in a layer shows why it was refused.
  if (error instanceof HTTPException) {
    c.status(error.status);
    return c.render(
      <ErrorPage status={error.status} message={error.message || "This request was refused"} />,
    );
  }
  console.error(error);
  c.status(500);

  const report = c.get("user") ? errorReport(error) : undefined;
  return c.render(<ErrorPage status={500} message="Something went wrong" report={report} />);
});

app.get("/health", (c) => c.text("ok"));
app.get(`${iconsPath}/:file`, (c) => {
  const svg = findIconSvg(c.req.param("file"));
  if (!svg) return c.notFound();
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});
for (const script of scripts) {
  app.get(script.path, (c) =>
    c.body(script.code, 200, {
      "Content-Type": "text/javascript",
      "Cache-Control": "public, max-age=31536000, immutable",
    }),
  );
}

// Registered before the middleware, so logging in and signing up don't require a user.
if (isDevLoginEnabled) app.route("/dev", dev);
app.route(signupPath, login.signup);
app.use(timeMiddleware("auth", login.requireUser));

app.get("/", (c) => c.redirect(monthPath(thisMonthInOslo(), false)));
app.route("/timesheet", timesheet);
app.route("/clients", clients);
app.route("/projects", projects);
app.route("/projects/:projectId/consultants", projectConsultants);
app.route("/reports", reports);
app.route("/month-close", monthClose);
app.route("/consultants", consultants);
app.route("/administration", administration);
app.route("/office-summary", officeSummary);

// Dev login lets anyone act as any user, so it must not be reachable from the network.
// Otherwise listen on all interfaces, which the Docker container needs.
export default {
  fetch: app.fetch,
  hostname: isDevLoginEnabled ? "127.0.0.1" : "0.0.0.0",
};
