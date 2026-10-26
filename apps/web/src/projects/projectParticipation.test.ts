import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import {
  clients,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects,
  users,
} from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { database } from "../database";
import { onlyRow } from "../testing/rows";
import { ensureParticipation, removeUnneededParticipation } from "./projectParticipation.data";

let ids: { projectId: number; orgId: number };
let userId: number;

const participates = async () =>
  (await database.$count(
    projectOrganizations,
    and(
      eq(projectOrganizations.projectId, ids.projectId),
      eq(projectOrganizations.orgId, ids.orgId),
    ),
  )) === 1;

beforeAll(async () => {
  await rebuildDatabase(database);
  const organization = onlyRow(
    await database.select().from(organizations).where(eq(organizations.slug, "oslo")),
  );
  const user = onlyRow(
    await database
      .insert(users)
      .values({ name: "Kari", email: "kari@variant.no", orgId: organization.id })
      .returning(),
  );
  const client = onlyRow(await database.insert(clients).values({ name: "Acme" }).returning());
  const project = onlyRow(
    await database
      .insert(projects)
      .values({
        clientId: client.id,
        code: "ACME-1",
        name: "Website",
        billing: "non_billable",
      })
      .returning(),
  );
  ids = { projectId: project.id, orgId: organization.id };
  userId = user.id;
});

test("an organization stays on a project while any reason to take part holds", async () => {
  await ensureParticipation(database, ids);
  await ensureParticipation(database, ids);
  expect(await participates()).toBe(true);

  await database.insert(projectAssignments).values({ ...ids, userId });
  await database.update(projectOrganizations).set({ isContractOwner: true, openToMembers: true });

  await removeUnneededParticipation(database, ids);
  expect(await participates()).toBe(true);

  await database.update(projectOrganizations).set({ isContractOwner: false });
  await removeUnneededParticipation(database, ids);
  expect(await participates()).toBe(true);

  await database.update(projectOrganizations).set({ openToMembers: false });
  await removeUnneededParticipation(database, ids);
  expect(await participates()).toBe(true);

  await database.delete(projectAssignments);
  await removeUnneededParticipation(database, ids);
  expect(await participates()).toBe(false);
});
