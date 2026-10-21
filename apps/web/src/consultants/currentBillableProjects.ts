import { clients, projectAssignments, projects } from "@tid/db/schema";
import { and, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { database } from "../database";

/** Billable projects each of the users is assigned to on `today`, ordered by project name. */
export async function loadCurrentBillableProjects(userIds: number[], today: string) {
  const rows = await database
    .select({
      userId: projectAssignments.userId,
      name: projects.name,
      client: clients.name,
      billing: projects.billing,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        inArray(projectAssignments.userId, userIds),
        ne(projects.billing, "non_billable"),
        or(isNull(projectAssignments.startsOn), lte(projectAssignments.startsOn, today)),
        or(isNull(projectAssignments.endsOn), gte(projectAssignments.endsOn, today)),
      ),
    )
    .orderBy(projects.name);
  return Map.groupBy(rows, (row) => row.userId);
}
