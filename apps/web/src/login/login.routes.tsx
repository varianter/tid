import { organizations, userIdentities, users } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { employeeCountry } from "./employeeEmail";
import {
  findUserByEmail,
  findUserByIdentity,
  identityProvider,
  readProxyIdentity,
} from "./login.middleware";
import { signupForm } from "./login.validation";
import { NotAnEmployeePage, SignupPage } from "./login.views";
import type { UserEnv } from "./user";

type SignupProps = {
  subject: string;
  email: string;
  organizations: { id: number; name: string }[];
};

type Identity = { subject: string; email: string };

// Lets people who log in for the first time become users, by choosing their organization.
export function signup(
  tenantId: string,
  readIdentity: (c: Context) => Identity | undefined = readProxyIdentity,
) {
  const routes = new Hono<UserEnv>();
  routes.on(
    ["GET", "POST"],
    "/",
    formAction<typeof signupForm, SignupProps>({
      schema: signupForm,
      loader: async (c) => {
        const identity = readIdentity(c);
        if (!identity) return c.text("Not logged in", 401);
        const isUser =
          (await findUserByIdentity(tenantId, identity.subject)) ??
          (await findUserByEmail(identity.email));
        if (isUser) return c.redirect("/");
        const country = employeeCountry(identity.email);
        if (!country) {
          c.status(403);
          return c.render(<NotAnEmployeePage email={identity.email} />);
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
      onSubmit: async (_c, { firstName, lastName, organizationId }, props) => {
        if (!props.organizations.some((organization) => organization.id === organizationId)) {
          return { fieldErrors: { organizationId: ["Choose your organization"] } };
        }
        await database.transaction(async (transaction) => {
          const [user] = await transaction
            .insert(users)
            .values({ name: `${firstName} ${lastName}`, email: props.email, orgId: organizationId })
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
        });
        return { redirect: "/" };
      },
      view: SignupPage,
    }),
  );
  return routes;
}
