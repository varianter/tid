export const administrationPath = (organizationSlug: string) =>
  `/administration/${organizationSlug}`;

export const openProjectsPath = (organizationSlug: string) =>
  `${administrationPath(organizationSlug)}/projects`;

export const managersPath = (organizationSlug: string) =>
  `${administrationPath(organizationSlug)}/managers`;
