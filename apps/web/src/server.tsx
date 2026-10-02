import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { devLogin, requireDevUser, type UserEnv } from "./auth/devLogin";
import { clients } from "./clients/routes";
import { Layout } from "./layout";
import { projects } from "./projects/routes";
import { reports } from "./reports/routes";
import { timesheet } from "./timesheet/routes";

const app = new Hono<UserEnv>();

app.use(
  jsxRenderer(({ children }, c) => (
    <Layout title="Tid" currentPath={c.req.path} user={c.get("user")}>
      {children}
    </Layout>
  )),
);

app.get("/health", (c) => c.text("ok"));

const isDevLoginEnabled = process.env.DEV_LOGIN === "true";

// Registered before the middleware, so the login page itself doesn't require a user.
if (isDevLoginEnabled) {
  app.route("/dev/login", devLogin);
  app.use(requireDevUser);
}

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
