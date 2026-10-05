import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { jsxRenderer } from "hono/jsx-renderer";
import { assignments } from "./assignments/assignments.routes";
import { clients } from "./clients/clients.routes";
import { dev, devLogoutUrl, devTenantId, readDevIdentity, requireDevUser } from "./dev/dev.routes";
import { errorReport } from "./errors/errorReport";
import { ErrorPage } from "./errors/errors.views";
import { Layout } from "./layout";
import { proxyLogoutUrl, requireProxyUser, signupPath } from "./login/login.middleware";
import { signup } from "./login/login.routes";
import type { UserEnv } from "./login/user";
import { projects } from "./projects/projects.routes";
import { reports } from "./reports/reports.routes";
import { timesheet } from "./timesheet/timesheet.routes";

const isDevLoginEnabled = process.env.DEV_LOGIN === "true";

function chooseLogin() {
  if (isDevLoginEnabled) {
    return {
      requireUser: requireDevUser,
      logoutUrl: devLogoutUrl,
      signup: signup(devTenantId, readDevIdentity),
    };
  }
  const tenantId = process.env.ENTRA_TENANT_ID;
  if (!tenantId) throw new Error("ENTRA_TENANT_ID is not set");
  return {
    requireUser: requireProxyUser(tenantId),
    logoutUrl: proxyLogoutUrl(tenantId),
    signup: signup(tenantId),
  };
}
const login = chooseLogin();

const app = new Hono<UserEnv>();

// Login is a session cookie, so form posts from other sites would otherwise be trusted.
app.use(csrf());
app.use(
  jsxRenderer(({ children }, c) => (
    <Layout title="Tid" currentPath={c.req.path} user={c.get("user")} logoutUrl={login.logoutUrl}>
      {children}
    </Layout>
  )),
);

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

// Registered before the middleware, so logging in and signing up don't require a user.
if (isDevLoginEnabled) app.route("/dev", dev);
app.route(signupPath, login.signup);
app.use(login.requireUser);

app.get("/", (c) => c.redirect("/timesheet"));
app.route("/timesheet", timesheet);
app.route("/clients", clients);
app.route("/projects", projects);
app.route("/projects/:projectId/assignments", assignments);
app.route("/reports", reports);

// Dev login lets anyone act as any user, so it must not be reachable from the network.
// Otherwise listen on all interfaces, which the Docker container needs.
export default {
  fetch: app.fetch,
  hostname: isDevLoginEnabled ? "127.0.0.1" : "0.0.0.0",
};
