import { projectOrganizations, users } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";

// Only users from the project's organizations may be assigned to it.
export const inProjectOrganization = (projectId: number) =>
  and(eq(projectOrganizations.orgId, users.orgId), eq(projectOrganizations.projectId, projectId));
