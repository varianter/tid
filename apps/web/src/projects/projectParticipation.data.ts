import type { Database } from "@tid/db/client";
import { projectAssignments, projectOrganizations, type projects } from "@tid/db/schema";
import { and, eq, not, notExists } from "drizzle-orm";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Participation = { projectId: number; orgId: number };

// Takes a project column too, so a query can match each project row.
export const participation = (projectId: number | typeof projects.id, orgId: number) =>
  and(eq(projectOrganizations.projectId, projectId), eq(projectOrganizations.orgId, orgId));

/** Adds the organization to the project unless it already takes part. */
export async function ensureParticipation(handle: Database | Transaction, ids: Participation) {
  await handle.insert(projectOrganizations).values(ids).onConflictDoNothing();
}

/**
 * Removes the organization from the project once it's no longer the contract owner,
 * has no one assigned, and isn't open to members.
 */
export async function removeUnneededParticipation(
  handle: Database | Transaction,
  ids: Participation,
) {
  await handle.delete(projectOrganizations).where(
    and(
      participation(ids.projectId, ids.orgId),
      not(projectOrganizations.isContractOwner),
      not(projectOrganizations.openToMembers),
      notExists(
        handle
          .select()
          .from(projectAssignments)
          .where(
            and(
              eq(projectAssignments.projectId, ids.projectId),
              eq(projectAssignments.orgId, ids.orgId),
            ),
          ),
      ),
    ),
  );
}
