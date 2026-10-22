import { isIsoDate } from "@tid/calendar/isoDate";
import { projectAssignments } from "@tid/db/schema";
import type { Context } from "hono";
import { database } from "../database";
import { type AssignmentIds, assignment, idParams } from "./assignment";

export const endAssignment = async (c: Context) => {
  const ids = idParams(c.req.param());
  if (!ids) return c.notFound();
  const { endsOn } = await c.req.parseBody();
  if (typeof endsOn !== "string" || !isIsoDate(endsOn)) return c.text("Bad request", 400);
  if (!(await endAssignmentOn(ids, endsOn))) return c.notFound();
  return c.redirect(`/projects/${ids.projectId}`, 303);
};

/** Keeps the assignment and its rates, so logged time can still be repriced. Returns false when there's no assignment. */
export async function endAssignmentOn(ids: AssignmentIds, endsOn: string) {
  const ended = await database
    .update(projectAssignments)
    .set({ endsOn })
    .where(assignment(ids))
    .returning({ userId: projectAssignments.userId });
  return ended.length > 0;
}
