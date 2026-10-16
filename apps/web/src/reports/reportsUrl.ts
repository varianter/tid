export const reportPath = (organizationSlug: string, query: URLSearchParams) =>
  `/reports/${organizationSlug}?${query}`;

export const projectTimesheetPath = (organizationSlug: string, code: string, month: string) =>
  `/reports/${organizationSlug}/projects/${encodeURIComponent(code)}/${month}`;
