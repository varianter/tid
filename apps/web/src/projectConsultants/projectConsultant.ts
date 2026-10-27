import { assignmentRates, projectAssignments } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";

export type ProjectConsultantIds = { projectId: number; userId: number };

export type NewRate = { validFrom: string; rate: number; currency: string };

export function idParams(params: Record<string, string>) {
  const projectId = Number(params.projectId);
  const userId = Number(params.userId);
  return Number.isSafeInteger(projectId) && Number.isSafeInteger(userId)
    ? { projectId, userId }
    : undefined;
}

export const assignment = ({ projectId, userId }: ProjectConsultantIds) =>
  and(eq(projectAssignments.projectId, projectId), eq(projectAssignments.userId, userId));

export const ratesOf = ({ projectId, userId }: ProjectConsultantIds) =>
  and(eq(assignmentRates.projectId, projectId), eq(assignmentRates.userId, userId));

export type Consultant = ProjectConsultantIds & {
  name: string;
  projectName: string;
  currency: string;
};

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
