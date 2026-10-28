import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { PublicEnv } from "../domain/users/user";
import { signupPath } from "./login.url";
import { findUserByEmail, findUserByIdentity, linkIdentity } from "./userIdentity.data";

// oauth2-proxy logs the user in with Entra and nginx overwrites these headers on every
// request, so they can be trusted as long as only the ingress can reach the app.
const subjectHeader = "x-auth-request-user";
const emailHeader = "x-auth-request-email";

export function readProxyIdentity(c: Context) {
  const subject = c.req.header(subjectHeader);
  const email = c.req.header(emailHeader);
  return subject && email ? { subject, email, name: readDisplayName(c) } : undefined;
}

const idTokenClaims = z.object({ name: z.string().trim().min(1) });

// oauth2-proxy forwards the ID token, the only place Entra puts the display name. nginx
// overwrites it like the headers above, so the signature isn't checked again. Neither is
// expiry: the token can outlive it briefly between oauth2-proxy's session refreshes.
function readDisplayName(c: Context) {
  const payload = c.req
    .header("authorization")
    ?.replace(/^Bearer /, "")
    .split(".")[1];
  if (!payload) return undefined;
  try {
    const claims = idTokenClaims.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    return claims.data?.name;
  } catch {
    return undefined;
  }
}

export const requireProxyUser = (tenantId: string) =>
  createMiddleware<PublicEnv>(async (c, next) => {
    const identity = readProxyIdentity(c);
    if (!identity) throw new HTTPException(401, { message: "Not logged in" });
    const { subject, email } = identity;

    let user = await findUserByIdentity(tenantId, subject);
    if (!user) {
      const userWithEmail = await findUserByEmail(email);
      // A user can't exist without an organization, so new people choose one first.
      if (!userWithEmail) return c.redirect(signupPath);
      user = await linkIdentity(tenantId, subject, userWithEmail);
    }
    if (!user)
      throw new HTTPException(403, {
        message: `${email} is already linked to a different sign-in. Ask the developers for help.`,
      });

    c.set("user", user);
    await next();
  });

// Clearing only oauth2-proxy's cookie would let Entra's single sign-on log the user straight
// back in, so it hands over to Entra's logout. The proxy must whitelist login.microsoftonline.com.
export function proxyLogoutUrl(tenantId: string) {
  const entraLogoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`;
  return `/oauth2/sign_out?rd=${encodeURIComponent(entraLogoutUrl)}`;
}
