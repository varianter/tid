import { users } from "@tid/db/schema";
import type { Context } from "hono";
import { consultantPath } from "../consultants/consultants.url";
import { listOrganizations } from "../domain/organizations/organization.data";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { employeeCountry } from "../login/employeeEmail";
import { RegisterConsultantFormPage, registerConsultantForm } from "./registerConsultant.form";

// Adds someone before their first login. Login then finds them by email, so they skip sign-up.
export const registerConsultant = formAction({
  schema: registerConsultantForm,
  loader: async (c: Context<UserEnv>) => ({
    organizations: await listOrganizations(),
    ownOrganizationId: c.get("user").organization.id,
  }),
  onSubmit: async (_c, { name, email, organizationId, firstDay }, { organizations }) => {
    const organization = organizations.find((candidate) => candidate.id === organizationId);
    if (!organization) {
      return { fieldErrors: { organizationId: ["Choose one of the organizations listed"] } };
    }
    // The same rule as sign-up, so nobody is registered somewhere they couldn't have chosen.
    const country = employeeCountry(email);
    if (!country) return { fieldErrors: { email: ["Use their Variant email address"] } };
    if (country !== organization.country) {
      return { fieldErrors: { email: [`This address isn't for ${organization.name}'s country`] } };
    }
    const [consultant] = await database
      .insert(users)
      .values({ name, email, orgId: organizationId, firstDay })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!consultant)
      return { fieldErrors: { email: ["Someone with this email is already in Tid"] } };
    return { redirect: consultantPath(consultant.id) };
  },
  view: RegisterConsultantFormPage,
});
