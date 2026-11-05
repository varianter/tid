import { rebuildDatabase } from "@tid/db/client";
import { clients, projectOrganizations, projects, tasks, timeEntries, users } from "@tid/db/schema";
import { database } from "../framework/database";
import type { UserRow } from "./loggedInUser";
import { onlyRow, organizationIdBySlug } from "./rows";

/**
 * October 2026 with hours on every kind of project, logged from Oslo, Bergen and across contract
 * owners in both countries. `member` is Ola in Oslo; `portalId` is Oslo's hourly project and
 * `internalId` its non-billable one.
 */
export async function seedInvoicingMonth() {
  await rebuildDatabase(database);
  const oslo = await organizationIdBySlug("oslo");
  const bergen = await organizationIdBySlug("bergen");
  const stockholm = await organizationIdBySlug("stockholm");
  const [member] = (await database
    .insert(users)
    .values([{ name: "Ola", email: "ola@variant.no", orgId: oslo }])
    .returning()) as [UserRow];
  const bergenMember = onlyRow(
    await database
      .insert(users)
      .values({ name: "Per", email: "per@variant.no", orgId: bergen })
      .returning(),
  );
  const client = onlyRow(await database.insert(clients).values({ name: "Ærlig Øl" }).returning());
  const project = async (
    code: string,
    name: string,
    billing: "hourly" | "fixed_fee" | "non_billable",
    contractOwnerId = oslo,
  ) => {
    const { id } = onlyRow(
      await database
        .insert(projects)
        .values({
          clientId: client.id,
          code,
          name,
          billing,
          currency: billing === "non_billable" ? null : "NOK",
        })
        .returning(),
    );
    await database
      .insert(projectOrganizations)
      .values({ projectId: id, orgId: contractOwnerId, isContractOwner: true });
    const task = onlyRow(
      await database.insert(tasks).values({ projectId: id, name: "Build" }).returning(),
    );
    return { id, taskId: task.id };
  };
  const portal = await project("OL-1", "Portal", "hourly");
  const fixed = await project("OL-2", "Fixed", "fixed_fee");
  const internal = await project("OL-3", "Internal", "non_billable");
  const bergenOwned = await project("OL-4", "Bergen owned", "hourly", bergen);
  const swedish = await project("OL-5", "Swedish", "hourly", stockholm);
  await database.insert(timeEntries).values([
    {
      userId: member.id,
      taskId: portal.taskId,
      spentOn: "2026-10-05",
      minutes: 450,
      rate: 150000,
      currency: "NOK",
    },
    { userId: member.id, taskId: fixed.taskId, spentOn: "2026-10-05", minutes: 60 },
    { userId: member.id, taskId: internal.taskId, spentOn: "2026-10-05", minutes: 60 },
    { userId: bergenMember.id, taskId: portal.taskId, spentOn: "2026-10-06", minutes: 60 },
    { userId: bergenMember.id, taskId: bergenOwned.taskId, spentOn: "2026-10-05", minutes: 60 },
    { userId: member.id, taskId: swedish.taskId, spentOn: "2026-10-05", minutes: 60 },
  ]);
  return { member, portalId: portal.id, internalId: internal.id };
}
