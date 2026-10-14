import { organizations, userIdentities, users } from "@tid/db/schema";
import { Button, Field, FormField, fieldErrorAttributes, Page, Select } from "@tid/ui";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";
import { database } from "../database";
import { type FormProps, formAction } from "../form/formAction";
import { employeeCountry } from "./employeeEmail";
import {
  findUserByEmail,
  findUserByIdentity,
  identityProvider,
  readProxyIdentity,
} from "./login.middleware";

const signUpForm = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  organizationId: z.coerce.number().int(),
});

type OrganizationOption = { id: number; name: string };

type SignUpProps = {
  subject: string;
  email: string;
  name?: string;
  organizations: OrganizationOption[];
};

type Identity = { subject: string; email: string; name?: string };

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
      });
      return { redirect: "/" };
    },
    view: SignUpPage,
  });

function SignUpPage({ email, name, organizations, values, fieldErrors }: SignUpProps & FormProps) {
  return (
    <Page title="Welcome to Tid">
      <p class="w-max-5">
        You're logging in as {email} for the first time. Tell us who you are and which Variant
        organization you work for. You can't change the organization yourself later.
      </p>
      <form method="post" class="stack-v gap-m w-max-5">
        <FormField
          name="name"
          label="Name"
          value={values?.name ?? name}
          errors={fieldErrors?.name}
          autocomplete="name"
          required
        />
        <Field name="organizationId" label="Organization" errors={fieldErrors?.organizationId}>
          <Select
            id="organizationId"
            name="organizationId"
            required
            {...fieldErrorAttributes("organizationId", fieldErrors?.organizationId)}
          >
            <option value="">Choose your organization</option>
            {organizations.map((organization) => (
              <option
                value={organization.id}
                selected={String(organization.id) === values?.organizationId}
              >
                {organization.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" class="w-max-content">
          Start using Tid
        </Button>
      </form>
    </Page>
  );
}

function NotAnEmployeePage({ email }: { email: string }) {
  return (
    <Page title="Tid is for Variant employees">
      <p class="w-max-5">{email} isn't a Variant email address, so it can't be used to sign up.</p>
    </Page>
  );
}
