import { userIdentities, userRoles, users } from "@tid/db/schema";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { database } from "../database";
import type { PublicEnv, User, UserEnv } from "./user";

// oauth2-proxy logs the user in with Entra and nginx overwrites these headers on every
// request, so they can be trusted as long as only the ingress can reach the app.
const subjectHeader = "x-auth-request-user";
const emailHeader = "x-auth-request-email";
export const identityProvider = "entra";
export const signupPath = "/signup";

export function readProxyIdentity(c: Context) {
  const subject = c.req.header(subjectHeader);
  const email = c.req.header(emailHeader);
  return subject && email ? { subject, email } : undefined;
}

export async function findUserByIdentity(tenantId: string, subject: string) {
  const [user] = await database
    .select(getTableColumns(users))
    .from(users)
    .innerJoin(userIdentities, eq(userIdentities.userId, users.id))
    .where(
      and(
        eq(userIdentities.provider, identityProvider),
        eq(userIdentities.tenantId, tenantId),
        eq(userIdentities.subject, subject),
      ),
    );
  return user;
}

export async function findUserByEmail(email: string) {
  const [user] = await database
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);
  return user;
}

// Imported users have no identity until their first login, so they are matched on email.
async function linkIdentity(tenantId: string, subject: string, user: User) {
  const [identity] = await database
    .insert(userIdentities)
    .values({ userId: user.id, provider: identityProvider, tenantId, subject })
    // Conflicts when concurrent first requests race, or when the email now belongs to someone
    // other than the subject the user is already linked to. Only the stored owner may log in.
    .onConflictDoNothing()
    .returning();
  if (identity) return user;
  const owner = await findUserByIdentity(tenantId, subject);
  return owner?.id === user.id ? user : undefined;
}

export const requireProxyUser = (tenantId: string) =>
  createMiddleware<PublicEnv>(async (c, next) => {
    const identity = readProxyIdentity(c);
    if (!identity) return c.text("Not logged in", 401);
    const { subject, email } = identity;

    let user = await findUserByIdentity(tenantId, subject);
    if (!user) {
      const userWithEmail = await findUserByEmail(email);
      // A user can't exist without an organization, so new people choose one first.
      if (!userWithEmail) return c.redirect(signupPath);
      user = await linkIdentity(tenantId, subject, userWithEmail);
    }
    if (!user) return c.text(`${email} belongs to another login`, 403);

    c.set("user", user);
    await next();
  });

// Clearing only oauth2-proxy's cookie would let Entra's single sign-on log the user straight
// back in, so it hands over to Entra's logout. The proxy must whitelist login.microsoftonline.com.
export function proxyLogoutUrl(tenantId: string) {
  const entraLogoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`;
  return `/oauth2/sign_out?rd=${encodeURIComponent(entraLogoutUrl)}`;
}

export async function isManager(userId: number) {
  const roles = await database
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "manager")));
  return roles.length > 0;
}

export const requireManager = createMiddleware<UserEnv>(async (c, next) => {
  if (!(await isManager(c.get("user").id))) return c.text("Only managers can do this", 403);
  await next();
});
