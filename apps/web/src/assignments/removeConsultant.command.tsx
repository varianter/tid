import { assignmentRates, projectAssignments } from "@tid/db/schema";
import { Button } from "@tid/ui";
import type { Context } from "hono";
import { database } from "../database";
import { removeUnneededParticipation } from "../projects/projectParticipation";
import { type AssignmentIds, assignment, idParams, ratesOf } from "./assignment";

export const removeConsultant = async (c: Context) => {
  const ids = idParams(c.req.param());
  if (!ids) return c.notFound();
  await unassignFromProject(ids);
  return c.redirect(`/projects/${ids.projectId}`, 303);
};

/**
 * Removes the assignment with its rates, and the user's organization from the project
 * once nothing else keeps it there. Logged time keeps its locked rate.
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

export function RemoveConsultantForm({ projectId, userId }: { projectId: number; userId: number }) {
  return (
    <form method="post" action={`/projects/${projectId}/assignments/${userId}/delete`}>
      <Button type="submit" data-variant="plain" data-size="small">
        Remove
      </Button>
    </form>
  );
}
