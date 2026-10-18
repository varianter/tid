import { bundleElements } from "@tid/elements/bundle";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { jsxRenderer } from "hono/jsx-renderer";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { assignments } from "./assignments/assignments.routes";
import { clients } from "./clients/clients.routes";
import { dev, devLogoutUrl, devTenantId, readDevIdentity, requireDevUser } from "./dev/dev.routes";
import { endOfTheMonth } from "./endOfTheMonth/endOfTheMonth.routes";
import { ErrorPage } from "./errors/errorPage";
import { errorReport } from "./errors/errorReport";
import { harvestImport } from "./harvestImport/harvestImport.routes";
import { Layout } from "./layout";
import { signupRouter } from "./login/login.routes";
import { proxyLogoutUrl, requireProxyUser } from "./login/proxyLogin.middleware";
import { signupPath } from "./login/signupUrl";
import type { PublicEnv } from "./login/user";
import { organizations } from "./organizations/organizations.routes";
import { projects } from "./projects/projects.routes";
import { reports } from "./reports/reports.routes";
import { reportDatabaseTiming, reportRenderTiming, timeMiddleware } from "./serverTiming";
import { timesheet } from "./timesheet/timesheet.routes";
import { users } from "./users/users.routes";

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

const elements = await bundleElements();

const app = new Hono<PublicEnv>();

app.use(timing({ totalDescription: "Total" }), reportDatabaseTiming);

app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Pages size grids and bars with style attributes.
      styleSrc: ["'self'", "'unsafe-inline'", "https://varde.variant.dev"],
      fontSrc: ["https://varde.variant.dev"],
      imgSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  }),
);
// Login is a session cookie, so form posts from other sites would otherwise be trusted.
app.use(csrf());
app.use(
  jsxRenderer(({ children }, c) => (
    <Layout
      title="Tid"
      currentPath={c.req.path}
      user={c.get("user")}
      logoutUrl={login.logoutUrl}
      elementsSrc={elements.path}
    >
      {children}
    </Layout>
  )),
);

app.use(reportRenderTiming);

app.notFound((c) => {
  c.status(404);
  return c.render(<ErrorPage status={404} message="Page not found" />);
});

app.onError((error, c) => {
  // Hono throws these itself, for example when the CSRF check fails.
  if (error instanceof HTTPException) return error.getResponse();
  console.error(error);
  c.status(500);

  const report = c.get("user") ? errorReport(error) : undefined;
  return c.render(<ErrorPage status={500} message="Something went wrong" report={report} />);
});

app.get("/health", (c) => c.text("ok"));
app.get(elements.path, (c) =>
  c.body(elements.code, 200, {
    "Content-Type": "text/javascript",
    "Cache-Control": "public, max-age=31536000, immutable",
  }),
);

// Registered before the middleware, so logging in and signing up don't require a user.
if (isDevLoginEnabled) app.route("/dev", dev);
app.route(signupPath, login.signup);
app.use(timeMiddleware("auth", login.requireUser));

app.get("/", (c) => c.redirect("/timesheet"));
app.route("/timesheet", timesheet);
app.route("/clients", clients);
app.route("/projects", projects);
app.route("/projects/:projectId/assignments", assignments);
app.route("/reports", reports);
app.route("/end-of-the-month", endOfTheMonth);
app.route("/users", users);
app.route("/organizations", organizations);
// Only needed until Tid takes over from Harvest.
app.route("/harvest-import", harvestImport);

// Dev login lets anyone act as any user, so it must not be reachable from the network.
// Otherwise listen on all interfaces, which the Docker container needs.
export default {
  fetch: app.fetch,
  hostname: isDevLoginEnabled ? "127.0.0.1" : "0.0.0.0",
};
