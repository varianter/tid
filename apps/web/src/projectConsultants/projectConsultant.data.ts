import { projectAssignments, projects, users } from "@tid/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { database } from "../database";
import { assignment, type Consultant, type ProjectConsultantIds } from "./projectConsultant";

/** Only consultants on hourly projects have rates, so other projects' are left out. */
export async function loadConsultant(ids: ProjectConsultantIds): Promise<Consultant | undefined> {
  const [consultant] = await database
    .select({
      projectId: projectAssignments.projectId,
      userId: projectAssignments.userId,
      name: users.name,
      projectName: projects.name,
      // Hourly projects always have one.
      currency: sql<string>`${projects.currency}`,
    })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(and(assignment(ids), eq(projects.billing, "hourly")));
  return consultant;
}
