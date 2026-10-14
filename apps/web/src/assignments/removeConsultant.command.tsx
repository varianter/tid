import { assignmentRates, projectAssignments } from "@tid/db/schema";
import { Button } from "@tid/ui";
import type { Context } from "hono";
import { database } from "../database";
import { assignment, idParams, ratesOf } from "./assignment";

// Rates hang off the assignment, so they go with it. Logged time keeps its locked rate.
export const removeConsultant = async (c: Context) => {
  const ids = idParams(c.req.param());
  if (!ids) return c.notFound();
  await database.transaction(async (transaction) => {
    await transaction.delete(assignmentRates).where(ratesOf(ids));
    await transaction.delete(projectAssignments).where(assignment(ids));
  });
  return c.redirect(`/projects/${ids.projectId}`, 303);
};

export function RemoveConsultantForm({ projectId, userId }: { projectId: number; userId: number }) {
  return (
    <form method="post" action={`/projects/${projectId}/assignments/${userId}/delete`}>
      <Button type="submit" data-variant="plain" data-size="small">
        Remove
      </Button>
    </form>
  );
}
