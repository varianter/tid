import { organizations, userRoles, users } from "@tid/db/schema";
import { Button, Page } from "@tid/ui";
import { and, eq, exists, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { database } from "../database";
import type { UserEnv } from "../login/user";

// Trusts whoever is named in a cookie, so only dev.ts turns it on.
const cookieName = "dev_user_email";
const loginPath = "/dev/login";
// Picking another user is all a dev logout needs.
export const devLogoutUrl = loginPath;

export const dev = new Hono<UserEnv>();

dev.get("/login", async (c) => {
  const people = await database
    .select({
      name: users.name,
      email: users.email,
      organization: organizations.name,
      endsOn: users.endsOn,
      isManager: exists(
        database
          .select()
          .from(userRoles)
          .where(and(eq(userRoles.userId, users.id), eq(userRoles.role, "manager"))),
      ),
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .orderBy(organizations.name, users.name);

  return c.render(
    <Page title="Log in as">
      <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
        {people.map((person) => (
          <li class="stack-h items-center gap-m surface-tinted p-xs px-m">
            <div class="stack-v flex-1">
              <span class="fw-medium">{person.name}</span>
              <span class="fs-s ink-subtle">
                {[
                  person.organization,
                  person.email,
                  person.isManager && "Manager",
                  person.endsOn && `Left ${person.endsOn}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <form method="post">
              <input type="hidden" name="email" value={person.email} />
              <Button type="submit" data-size="small">
                Log in
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </Page>,
  );
});

dev.post("/login", async (c) => {
  const { email } = await c.req.parseBody();
  if (typeof email !== "string") return c.text("Missing email", 400);
  setCookie(c, cookieName, email, { path: "/", httpOnly: true, sameSite: "Lax" });
  return c.redirect("/", 303);
});

export const requireDevUser = createMiddleware<UserEnv>(async (c, next) => {
  const email = getCookie(c, cookieName);
  const [user] = email
    ? await database.select().from(users).where(sql`lower(${users.email}) = lower(${email})`)
    : [];
  if (!user) {
    // The user may be gone after the database was reset.
    deleteCookie(c, cookieName, { path: "/" });
    return c.redirect(loginPath);
  }
  c.set("user", user);
  await next();
});
