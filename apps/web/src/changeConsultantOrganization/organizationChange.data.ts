import type { Database, Transaction } from "@tid/db/client";
import {
  clients,
  monthLocks,
  organizations,
  projectAssignments,
  projects,
  timeEntries,
  users,
} from "@tid/db/schema";
import { eq, exists, or } from "drizzle-orm";
import type { OrganizationChangeFacts } from "./organizationChange";

/** The consultant and what decides whether they can change organization. */
export async function loadOrganizationChange(handle: Database | Transaction, userId: number) {
  const [consultant] = await handle
    .select({
      id: users.id,
      name: users.name,
      organization: {
        id: organizations.id,
        name: organizations.name,
        country: organizations.country,
      },
      hasLoggedTime: exists(
        handle.select().from(timeEntries).where(eq(timeEntries.userId, users.id)),
      ).mapWith(Boolean),
      hasChangedMonthLocks: exists(
        handle
          .select()
          .from(monthLocks)
          .where(or(eq(monthLocks.lockedBy, users.id), eq(monthLocks.unlockedBy, users.id))),
      ).mapWith(Boolean),
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.id, userId));
  if (!consultant) return undefined;

  const assigned = await handle
    .select({ project: projects.name, client: clients.name })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projectAssignments.userId, userId))
    .orderBy(clients.name, projects.name);

  const { hasLoggedTime, hasChangedMonthLocks, ...rest } = consultant;
  const facts: OrganizationChangeFacts = {
    organizationName: consultant.organization.name,
    hasLoggedTime,
    assignedProjects: assigned.map(({ project, client }) => `${project} (${client})`),
    hasChangedMonthLocks,
  };
  return { consultant: rest, facts };
}

/**
 * Holds the consultant's row until the transaction ends. Logging time or an assignment checks the
 * row first, so it waits for the change instead of slipping in between the check and the update.
 */
export async function lockConsultant(transaction: Transaction, userId: number) {
  await transaction.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
}

export async function setConsultantOrganization(
  transaction: Transaction,
  userId: number,
  orgId: number,
) {
  await transaction.update(users).set({ orgId }).where(eq(users.id, userId));
}
