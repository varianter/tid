import { withQuery } from "../framework/returnTo";

/**
 * The administration pages. Each one is about the organization in `?organization=`, or the
 * manager's own when it names none.
 */
export const administrationPath = "/administration";

const forOrganization = (path: string, organizationSlug?: string) =>
  organizationSlug === undefined ? path : withQuery(path, { organization: organizationSlug });

export const openProjectsPath = (organizationSlug?: string) =>
  forOrganization(`${administrationPath}/projects`, organizationSlug);

export const managersPath = (organizationSlug?: string) =>
  forOrganization(`${administrationPath}/managers`, organizationSlug);

/** Where a member's manager role is given, or taken away under `/delete`. */
export const managerRolePath = (userId: number) => `${administrationPath}/managers/${userId}`;

/** Lists an organization's consultants, each linking to `returnTo` with their `userId` added. */
export const consultantPickerPath = (returnTo: string, organizationSlug?: string) =>
  withQuery(forOrganization(`${administrationPath}/consultants/pick`, organizationSlug), {
    returnTo,
  });
