import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { clients, projectOrganizations, projects, users } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { database } from "../database";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { assignToProject } from "./assignConsultants.command";
import { unassignFromProject } from "./endAssignment.command";
import { assignmentState } from "./projectConsultant";

let projectId: number;
let ownerId: number;
let ownerOrgId: number;
let guestId: number;
let guestOrgId: number;

const participation = (orgId: number) =>
  database
    .select()
    .from(projectOrganizations)
    .where(
      and(eq(projectOrganizations.projectId, projectId), eq(projectOrganizations.orgId, orgId)),
    );

beforeAll(async () => {
  await rebuildDatabase(database);
  ownerOrgId = await organizationIdBySlug("oslo");
  guestOrgId = await organizationIdBySlug("bergen");
  const addUser = async (name: string, orgId: number) =>
    onlyRow(
      await database
        .insert(users)
        .values({ name, email: `${name.toLowerCase()}@variant.no`, orgId })
        .returning(),
    ).id;
  ownerId = await addUser("Kari", ownerOrgId);
  guestId = await addUser("Ola", guestOrgId);
  const client = onlyRow(await database.insert(clients).values({ name: "Acme" }).returning());
  projectId = onlyRow(
    await database
      .insert(projects)
      .values({
        clientId: client.id,
        code: "ACME-1",
        name: "Website",
        billing: "non_billable",
      })
      .returning(),
  ).id;
  await database
    .insert(projectOrganizations)
    .values({ projectId, orgId: ownerOrgId, isContractOwner: true });
});

test("assigning someone from outside the project brings their organization in", async () => {
  await assignToProject(projectId, [{ userId: guestId, orgId: guestOrgId }]);
  expect(await participation(guestOrgId)).toHaveLength(1);
});

test("unassigning the last one from an organization takes it out of the project", async () => {
  await unassignFromProject({ projectId, userId: guestId });
  expect(await participation(guestOrgId)).toHaveLength(0);
});

test("the contract owner stays after its last consultant leaves", async () => {
  await assignToProject(projectId, [{ userId: ownerId, orgId: ownerOrgId }]);
  await unassignFromProject({ projectId, userId: ownerId });
  expect(await participation(ownerOrgId)).toHaveLength(1);
});

test("an organization open to members stays after its last consultant leaves", async () => {
  await assignToProject(projectId, [{ userId: guestId, orgId: guestOrgId }]);
  await database
    .update(projectOrganizations)
    .set({ openToMembers: true })
    .where(
      and(
        eq(projectOrganizations.projectId, projectId),
        eq(projectOrganizations.orgId, guestOrgId),
      ),
    );
  await unassignFromProject({ projectId, userId: guestId });
  expect(await participation(guestOrgId)).toHaveLength(1);
});

test("an assignment counts until its last day, and leaving the company overrides it", () => {
  const today = "2026-10-22";
  expect(assignmentState({ endsOn: null, leftOn: null }, today)).toBe("onProject");
  expect(assignmentState({ endsOn: today, leftOn: null }, today)).toBe("onProject");
  expect(assignmentState({ endsOn: "2026-10-21", leftOn: null }, today)).toBe("offProject");
  expect(assignmentState({ endsOn: null, leftOn: "2026-10-21" }, today)).toBe("leftCompany");
  expect(assignmentState({ endsOn: "2026-09-30", leftOn: "2026-10-21" }, today)).toBe(
    "leftCompany",
  );
});
