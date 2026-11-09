import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { consultantPickerPath } from "../administration/administration.url";
import { listOrganizations } from "../domain/organizations/organization.data";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { formAction, withSaved } from "../framework/formAction";
import { idParam } from "../framework/pageUrl";
import {
  ChangeConsultantOrganizationFormPage,
  changeConsultantOrganizationForm,
} from "./changeConsultantOrganization.form";
import { changeConsultantOrganizationPath } from "./changeConsultantOrganization.url";
import { organizationChangeBlockers } from "./organizationChange";
import {
  loadOrganizationChange,
  lockConsultant,
  setConsultantOrganization,
} from "./organizationChange.data";

// Fixes a wrong choice at sign-up; see organizationChange.ts for why it stops there.
export const changeConsultantOrganization = formAction({
  schema: changeConsultantOrganizationForm,
  loader: async (c: Context<UserEnv>) => {
    const userId = idParam.safeParse(c.req.query("userId"));
    if (!userId.success) {
      return c.redirect(
        consultantPickerPath(changeConsultantOrganizationPath(), c.get("user").organization.slug),
      );
    }
    const change = await loadOrganizationChange(database, userId.data);
    if (!change) return c.notFound();
    const { consultant, facts } = change;
    return {
      consultant,
      blockers: organizationChangeBlockers(facts),
      // The others in the same country, as sign-up offers.
      destinations: (await listOrganizations()).filter(
        (other) =>
          other.country === consultant.organization.country &&
          other.id !== consultant.organization.id,
      ),
    };
  },
  onSubmit: async (_c, { organizationId }, { consultant, destinations }) => {
    if (!destinations.some((destination) => destination.id === organizationId)) {
      return { fieldErrors: { organizationId: ["Choose one of the organizations listed"] } };
    }
    const blockers = await database.transaction(async (transaction) => {
      await lockConsultant(transaction, consultant.id);
      const change = await loadOrganizationChange(transaction, consultant.id);
      if (!change) throw new HTTPException(404);
      const blockers = organizationChangeBlockers(change.facts);
      if (blockers.length === 0) {
        await setConsultantOrganization(transaction, consultant.id, organizationId);
      }
      return blockers;
    });
    if (blockers.length > 0) return { formError: blockers.join(" ") };
    return { redirect: withSaved(changeConsultantOrganizationPath(consultant.id)) };
  },
  view: ChangeConsultantOrganizationFormPage,
});
