import { organizations, userIdentities, userRoles, users } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { employeeCountry } from "./employeeEmail";
import { NotAnEmployeePage } from "./notAnEmployeePage";
import { readProxyIdentity } from "./proxyLogin.middleware";
import { SignUpFields, type SignUpProps, signUpForm, signUpFrame } from "./signUp.form";
import { findUserByEmail, findUserByIdentity, identityProvider } from "./userIdentity";

type Identity = { subject: string; email: string; name?: string };

// Someone has to be the first manager, since managers assign everyone else's role. Only granted on
// sign-up, so removing the role later sticks.
function isBootstrapManager(email: string) {
  const emails = process.env.BOOTSTRAP_MANAGER_EMAILS?.split(",") ?? [];
  return emails.some((manager) => manager.trim().toLowerCase() === email.toLowerCase());
}

// Lets people who log in for the first time become users, by choosing their organization.
export const signUp = (
  tenantId: string,
  readIdentity: (c: Context) => Identity | undefined = readProxyIdentity,
) =>
  formAction<typeof signUpForm, SignUpProps>({
    schema: signUpForm,
    loader: async (c) => {
      const identity = readIdentity(c);
      if (!identity) return c.text("Not logged in", 401);
      const existingUser =
        (await findUserByIdentity(tenantId, identity.subject)) ??
        (await findUserByEmail(identity.email));
      if (existingUser) return c.redirect("/");
      const country = employeeCountry(identity.email);
      if (!country) {
        c.status(403);
        return c.render(NotAnEmployeePage({ email: identity.email }));
      }
      return {
        ...identity,
        organizations: await database
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(eq(organizations.country, country))
          .orderBy(organizations.name),
      };
    },
    onSubmit: async (_c, { name, organizationId }, props) => {
      if (!props.organizations.some((organization) => organization.id === organizationId)) {
        return { fieldErrors: { organizationId: ["Choose your organization"] } };
      }
      await database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({ name, email: props.email, orgId: organizationId })
          // Another request signed this person up first; the login middleware takes it from here.
          .onConflictDoNothing()
          .returning();
        if (!user) return;
        await transaction.insert(userIdentities).values({
          userId: user.id,
          provider: identityProvider,
          tenantId,
          subject: props.subject,
        });
        if (isBootstrapManager(user.email)) {
          await transaction.insert(userRoles).values({ userId: user.id, role: "manager" });
        }
      });
      return { redirect: "/" };
    },
    frame: signUpFrame,
    view: SignUpFields,
  });
