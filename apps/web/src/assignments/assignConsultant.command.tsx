import { projectAssignments, projectOrganizations, users } from "@tid/db/schema";
import { Button, Select } from "@tid/ui";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { inProjectOrganization } from "./assignable";
import { idParams } from "./assignment";

export const assignConsultant = async (c: Context) => {
  const ids = idParams({ ...c.req.param(), userId: String((await c.req.parseBody()).userId) });
  if (!ids) return c.notFound();

  // Looking the user up through the project's organizations skips anyone outside them,
  // instead of tripping the foreign key.
  const [user] = await database
    .select({ orgId: users.orgId })
    .from(users)
    .innerJoin(projectOrganizations, inProjectOrganization(ids.projectId))
    .where(eq(users.id, ids.userId));
  if (user) {
    await database
      .insert(projectAssignments)
      .values({ ...ids, orgId: user.orgId })
      .onConflictDoNothing();
  }
  return c.redirect(`/projects/${ids.projectId}`, 303);
};

type Person = { id: number; name: string };

export function AssignConsultantForm({
  projectId,
  assignablePeople,
}: {
  projectId: number;
  assignablePeople: Person[];
}) {
  return (
    <form
      method="post"
      action={`/projects/${projectId}/assignments`}
      class="stack-h items-center gap-xs"
    >
      <Select name="userId" aria-label="Consultant to assign" required>
        <option value="">Choose a consultant</option>
        {assignablePeople.map((person) => (
          <option value={person.id}>{person.name}</option>
        ))}
      </Select>
      <Button type="submit">Assign</Button>
    </form>
  );
}
