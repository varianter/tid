import { assignmentRates, projectAssignments, tasks, timeEntries } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { removeUnneededParticipation } from "../projects/projectParticipation";
import { type AssignmentIds, assignment, idParams, ratesOf } from "./assignment";

export const removeConsultant = async (c: Context) => {
  const ids = idParams(c.req.param());
  if (!ids) return c.notFound();
  if (await hasLoggedTime(ids)) {
    return c.text("They have logged hours on the project, so end the assignment instead", 409);
  }
  await unassignFromProject(ids);
  return c.redirect(`/projects/${ids.projectId}`, 303);
};

async function hasLoggedTime({ projectId, userId }: AssignmentIds) {
  const [entry] = await database
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(and(eq(tasks.projectId, projectId), eq(timeEntries.userId, userId)))
    .limit(1);
  return entry !== undefined;
}

/**
 * Undoes a mistaken assignment: removes it with its rates, and the user's organization from the
 * project once nothing else keeps it there.
 */
export async function unassignFromProject(ids: AssignmentIds) {
  await database.transaction(async (transaction) => {
    await transaction.delete(assignmentRates).where(ratesOf(ids));
    const removed = await transaction
      .delete(projectAssignments)
      .where(assignment(ids))
      .returning({ orgId: projectAssignments.orgId });
    for (const { orgId } of removed) {
      await removeUnneededParticipation(transaction, { projectId: ids.projectId, orgId });
    }
  });
}
