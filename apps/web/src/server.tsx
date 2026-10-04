import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { jsxRenderer } from "hono/jsx-renderer";
import { clients } from "./clients/clients.routes";
import { dev, devLogoutUrl, requireDevUser } from "./dev/dev.routes";
import { Layout } from "./layout";
import { proxyLogoutUrl, requireProxyUser } from "./login/login.middleware";
import type { UserEnv } from "./login/user";
import { projects } from "./projects/projects.routes";
import { reports } from "./reports/reports.routes";
import { timesheet } from "./timesheet/timesheet.routes";

const isDevLoginEnabled = process.env.DEV_LOGIN === "true";

function chooseLogin() {
  if (isDevLoginEnabled) return { requireUser: requireDevUser, logoutUrl: devLogoutUrl };
  const tenantId = process.env.ENTRA_TENANT_ID;
  if (!tenantId) throw new Error("ENTRA_TENANT_ID is not set");
  return { requireUser: requireProxyUser(tenantId), logoutUrl: proxyLogoutUrl(tenantId) };
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

app.get("/health", (c) => c.text("ok"));

// Registered before the middleware, so the login page itself doesn't require a user.
if (isDevLoginEnabled) app.route("/dev", dev);
app.use(login.requireUser);

app.get("/", (c) => c.redirect("/timesheet"));
app.route("/timesheet", timesheet);
app.route("/clients", clients);
app.route("/projects", projects);
app.route("/reports", reports);

// Dev login lets anyone act as any user, so it must not be reachable from the network.
// Otherwise listen on all interfaces, which the Docker container needs.
export default {
  fetch: app.fetch,
  hostname: isDevLoginEnabled ? "127.0.0.1" : "0.0.0.0",
};
