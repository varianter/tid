import { projectAssignments, projects, users } from "@tid/db/schema";
import { Button, Select } from "@tid/ui";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { managesProject } from "../managers/manager";
import { ensureParticipation } from "../projects/projectParticipation";
import { type AssignmentIds, idParams } from "./assignment";

export const assignConsultant = async (c: Context<UserEnv>) => {
  const ids = idParams({ ...c.req.param(), userId: String((await c.req.parseBody()).userId) });
  if (!ids) return c.notFound();
  const manager = c.get("user");
  const [consultant] = await database
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, ids.userId));
  if (consultant?.orgId !== manager.orgId && !(await managesProject(manager, ids.projectId))) {
    return c.text("Only managers of the project's organizations can assign other consultants", 403);
  }
  if (!(await assignToProject(ids))) return c.notFound();
  return c.redirect(`/projects/${ids.projectId}`, 303);
};

/**
 * Assigns the user, bringing their organization into the project if it isn't already.
 * Returns false when the user or project doesn't exist.
 */
export async function assignToProject(ids: AssignmentIds) {
  const [user] = await database
    .select({ orgId: users.orgId })
    .from(users)
    .where(eq(users.id, ids.userId));
  const [project] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, ids.projectId));
  if (!user || !project) return false;
  await database.transaction(async (transaction) => {
    await ensureParticipation(transaction, { projectId: ids.projectId, orgId: user.orgId });
    await transaction
      .insert(projectAssignments)
      .values({ ...ids, orgId: user.orgId })
      .onConflictDoNothing();
  });
  return true;
}

export type AssignablePerson = { id: number; name: string; orgName: string };

export function AssignConsultantForm({
  projectId,
  assignablePeople,
}: {
  projectId: number;
  assignablePeople: AssignablePerson[];
}) {
  const peopleByOrganization = Map.groupBy(assignablePeople, (person) => person.orgName);
  return (
    <form
      method="post"
      action={`/projects/${projectId}/assignments`}
      class="stack-h items-center gap-xs"
    >
      <Select name="userId" aria-label="Consultant to assign" required>
        <option value="">Choose a consultant</option>
        {[...peopleByOrganization].map(([orgName, people]) => (
          <optgroup label={orgName}>
            {people.map((person) => (
              <option value={person.id}>{person.name}</option>
            ))}
          </optgroup>
        ))}
      </Select>
      <Button type="submit">Assign</Button>
    </form>
  );
}
