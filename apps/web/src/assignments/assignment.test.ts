import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { clients, projectOrganizations, projects, users } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { database } from "../database";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { assignToProject } from "./assignConsultant.command";
import { unassignFromProject } from "./removeConsultant.command";

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
      .values({ clientId: client.id, code: "ACME-1", name: "Website", billable: false })
      .returning(),
  ).id;
  await database
    .insert(projectOrganizations)
    .values({ projectId, orgId: ownerOrgId, isContractOwner: true });
});

test("assigning someone from outside the project brings their organization in", async () => {
  expect(await assignToProject({ projectId, userId: guestId })).toBe(true);
  expect(await participation(guestOrgId)).toHaveLength(1);
});

test("unassigning the last one from an organization takes it out of the project", async () => {
  await unassignFromProject({ projectId, userId: guestId });
  expect(await participation(guestOrgId)).toHaveLength(0);
});

test("the contract owner stays after its last consultant leaves", async () => {
  await assignToProject({ projectId, userId: ownerId });
  await unassignFromProject({ projectId, userId: ownerId });
  expect(await participation(ownerOrgId)).toHaveLength(1);
});

test("an organization open to members stays after its last consultant leaves", async () => {
  await assignToProject({ projectId, userId: guestId });
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

test("assigning a user or project that doesn't exist fails", async () => {
  expect(await assignToProject({ projectId, userId: 999999 })).toBe(false);
  expect(await assignToProject({ projectId: 999999, userId: guestId })).toBe(false);
});
