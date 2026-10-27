import { todayInOslo } from "@tid/calendar/osloClock";
import { assignmentRates, projectAssignments, tasks, timeEntries, users } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { removeUnneededParticipation } from "../projects/projectParticipation.data";
import { EndAssignmentFields, endAssignmentForm, endAssignmentFrame } from "./endAssignment.form";
import { assignment, idParams, type ProjectConsultantIds, ratesOf } from "./projectConsultant";

// Without logged time there's nothing to keep, so ending removes the consultant instead.
export const endAssignment = formAction({
  schema: endAssignmentForm,
  loader: async (c) => {
    const ids = idParams(c.req.param());
    if (!ids) return c.notFound();
    const [consultant] = await database
      .select({ name: users.name })
      .from(projectAssignments)
      .innerJoin(users, eq(users.id, projectAssignments.userId))
      .where(assignment(ids));
    if (!consultant) return c.notFound();
    return { ids, ...consultant, hasLoggedTime: await hasLoggedTime(ids), today: todayInOslo() };
  },
  onSubmit: async (_c, { endsOn }, { ids, hasLoggedTime }) => {
    if (!hasLoggedTime) {
      await unassignFromProject(ids);
    } else if (endsOn) {
      // Keeps the assignment and its rates, so logged time can still be repriced.
      await database.update(projectAssignments).set({ endsOn }).where(assignment(ids));
    } else {
      return { fieldErrors: { endsOn: ["Choose a date"] } };
    }
    return { redirect: `/projects/${ids.projectId}` };
  },
  frame: endAssignmentFrame,
  view: EndAssignmentFields,
});

async function hasLoggedTime({ projectId, userId }: ProjectConsultantIds) {
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
export async function unassignFromProject(ids: ProjectConsultantIds) {
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
