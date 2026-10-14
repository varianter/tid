import {
  assignmentRates,
  organizations,
  projectAssignments,
  projects,
  users,
} from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
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

export type Consultant = AssignmentIds & {
  name: string;
  projectName: string;
  currency: string;
};

export async function loadConsultant(ids: AssignmentIds): Promise<Consultant | undefined> {
  const [consultant] = await database
    .select({
      projectId: projectAssignments.projectId,
      userId: projectAssignments.userId,
      name: users.name,
      projectName: projects.name,
      currency: organizations.currency,
    })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .innerJoin(organizations, eq(organizations.id, projectAssignments.orgId))
    .where(assignment(ids));
  return consultant;
}
