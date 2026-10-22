import { assignmentRates, projectAssignments, projects, users } from "@tid/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { database } from "../database";

export type AssignmentIds = { projectId: number; userId: number };

export function idParams(params: Record<string, string>) {
  const projectId = Number(params.projectId);
  const userId = Number(params.userId);
  return Number.isSafeInteger(projectId) && Number.isSafeInteger(userId)
    ? { projectId, userId }
    : undefined;
}

export const assignment = ({ projectId, userId }: AssignmentIds) =>
  and(eq(projectAssignments.projectId, projectId), eq(projectAssignments.userId, userId));

export const ratesOf = ({ projectId, userId }: AssignmentIds) =>
  and(eq(assignmentRates.projectId, projectId), eq(assignmentRates.userId, userId));

export const ratesPath = ({ projectId, userId }: AssignmentIds) =>
  `/projects/${projectId}/assignments/${userId}/rates`;

export const stateOrder = ["onProject", "offProject", "leftCompany"] as const;
export type AssignmentState = (typeof stateOrder)[number];

// Leaving the company ends every assignment, so it wins over the assignment's own end.
export function assignmentState(
  { endsOn, leftOn }: { endsOn: string | null; leftOn: string | null },
  today: string,
): AssignmentState {
  if (leftOn && leftOn < today) return "leftCompany";
  if (endsOn && endsOn < today) return "offProject";
  return "onProject";
}

export type Consultant = AssignmentIds & {
  name: string;
  projectName: string;
  currency: string;
};

/** Only assignments on hourly projects have rates, so other projects' are left out. */
export async function loadConsultant(ids: AssignmentIds): Promise<Consultant | undefined> {
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
