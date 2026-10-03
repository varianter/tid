import { userIdentities, users } from "@tid/db/schema";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { database } from "../database";
import type { UserEnv } from "./user";

// oauth2-proxy logs the user in with Entra and nginx overwrites these headers on every
// request, so they can be trusted as long as only the ingress can reach the app.
const subjectHeader = "x-auth-request-user";
const emailHeader = "x-auth-request-email";
const provider = "entra";

async function findUserByIdentity(tenantId: string, subject: string) {
  const [user] = await database
    .select(getTableColumns(users))
    .from(users)
    .innerJoin(userIdentities, eq(userIdentities.userId, users.id))
    .where(
      and(
        eq(userIdentities.provider, provider),
        eq(userIdentities.tenantId, tenantId),
        eq(userIdentities.subject, subject),
      ),
    );
  return user;
}

// Users have no identity until their first login, so they are matched on the imported email.
async function linkUserByEmail(tenantId: string, subject: string, email: string) {
  const [user] = await database
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);
  if (!user) return undefined;
  await database
    .insert(userIdentities)
    .values({ userId: user.id, provider, tenantId, subject })
    // Concurrent first requests may both try to link.
    .onConflictDoNothing();
  return user;
}

export const requireProxyUser = (tenantId: string) =>
  createMiddleware<UserEnv>(async (c, next) => {
    const subject = c.req.header(subjectHeader);
    const email = c.req.header(emailHeader);
    if (!subject || !email) return c.text("Not logged in", 401);

    const user =
      (await findUserByIdentity(tenantId, subject)) ??
      (await linkUserByEmail(tenantId, subject, email));
    // Users come from the Harvest import, since a user can't exist without an organization.
    if (!user) return c.text(`No user with the email ${email}`, 403);

    c.set("user", user);
    await next();
  });

// Clearing only oauth2-proxy's cookie would let Entra's single sign-on log the user straight
// back in, so it hands over to Entra's logout. The proxy must whitelist login.microsoftonline.com.
export function proxyLogoutUrl(tenantId: string) {
  const entraLogoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`;
  return `/oauth2/sign_out?rd=${encodeURIComponent(entraLogoutUrl)}`;
}
