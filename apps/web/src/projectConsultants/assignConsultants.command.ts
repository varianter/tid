import { todayInOslo } from "@tid/calendar/osloClock";
import { organizations, projectAssignments, projects, users } from "@tid/db/schema";
import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import type { User } from "../login/user";
import { managesProject } from "../managers/manager";
import { ensureParticipation } from "../projects/projectParticipation";
import { AssignConsultantsPage, assignConsultantsForm } from "./assignConsultants.form";

export const assignConsultants = formAction({
  schema: assignConsultantsForm,
  loader: async (c) => {
    const projectId = Number(c.req.param("projectId"));
    if (!Number.isSafeInteger(projectId)) return c.notFound();
    const [project] = await database
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return c.notFound();
    const user: User = c.get("user");
    const canManageProject = await managesProject(user, projectId);
    const today = todayInOslo();
    const people = await database
      .select({
        id: users.id,
        name: users.name,
        orgId: users.orgId,
        orgName: organizations.name,
        leftProjectOn: projectAssignments.endsOn,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .leftJoin(
        projectAssignments,
        and(eq(projectAssignments.projectId, projectId), eq(projectAssignments.userId, users.id)),
      )
      .where(
        and(
          canManageProject ? undefined : eq(users.orgId, user.orgId),
          or(isNull(users.endsOn), gte(users.endsOn, today)),
          // Someone whose assignment ended is assigned again the same way.
          or(isNull(projectAssignments.userId), lt(projectAssignments.endsOn, today)),
        ),
      )
      .orderBy(organizations.name, users.name);
    return { project, people };
  },
  // Anyone missing from the page's list is someone this manager may not assign, or the list
  // went stale, so the page is shown again with who can be assigned now.
  onSubmit: async (_c, { userId }, { project, people }) => {
    const assignable = new Map(people.map((person) => [person.id, person]));
    const chosen = userId.map((id) => assignable.get(id));
    if (!chosen.every((person) => person !== undefined)) {
      return { fieldErrors: { userId: ["Someone you chose can't be assigned. Choose again."] } };
    }
    await assignToProject(
      project.id,
      chosen.map((person) => ({ userId: person.id, orgId: person.orgId })),
    );
    return { redirect: `/projects/${project.id}` };
  },
  view: AssignConsultantsPage,
});

/**
 * Assigns the consultants, bringing their organizations into the project if they aren't already.
 * Reassigning reopens an ended assignment, keeping its rates.
 */
export async function assignToProject(
  projectId: number,
  consultants: { userId: number; orgId: number }[],
) {
  await database.transaction(async (transaction) => {
    for (const orgId of new Set(consultants.map((consultant) => consultant.orgId))) {
      await ensureParticipation(transaction, { projectId, orgId });
    }
    await transaction
      .insert(projectAssignments)
      .values(consultants.map((consultant) => ({ projectId, ...consultant })))
      .onConflictDoUpdate({
        target: [projectAssignments.projectId, projectAssignments.userId],
        set: { endsOn: null },
      });
  });
}
