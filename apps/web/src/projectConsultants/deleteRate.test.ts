import { beforeAll, expect, test } from "bun:test";
import { addDays } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import { rebuildDatabase } from "@tid/db/client";
import {
  assignmentRates,
  clients,
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  userRoles,
  users,
} from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../framework/database";
import { postForm, requestAsUser, type UserRow } from "../testing/loggedInUser";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { timesheet } from "../timesheet/timesheet.routes";
import { projectConsultants } from "./projectConsultants.routes";
import { addRateAndReprice } from "./repricing.data";

let consultant: UserRow;
let consultantWithoutRates: UserRow;
let manager: UserRow;
let projectId: number;
let taskId: number;

beforeAll(async () => {
  await rebuildDatabase(database);
  const orgId = await organizationIdBySlug("oslo");
  const addUser = async (name: string, email: string) =>
    onlyRow(await database.insert(users).values({ name, email, orgId }).returning());
  consultant = await addUser("Kari", "kari@variant.no");
  consultantWithoutRates = await addUser("Ola", "ola@variant.no");
  manager = await addUser("Henrik", "henrik@variant.no");
  await database.insert(userRoles).values({ userId: manager.id, role: "manager" });
  const client = onlyRow(await database.insert(clients).values({ name: "Acme" }).returning());
  const project = onlyRow(
    await database
      .insert(projects)
      .values({
        clientId: client.id,
        code: "ACME-1",
        name: "Website",
        currency: "NOK",
        billing: "hourly",
      })
      .returning(),
  );
  projectId = project.id;
  taskId = onlyRow(
    await database.insert(tasks).values({ projectId, name: "Development" }).returning(),
  ).id;
  await database.insert(projectOrganizations).values({ projectId, orgId, isContractOwner: true });
  await database.insert(projectAssignments).values([
    { projectId, userId: consultant.id, orgId },
    { projectId, userId: consultantWithoutRates.id, orgId },
  ]);
  await database
    .insert(assignmentRates)
    .values({ projectId, userId: consultant.id, validFrom: "2026-01-01", rate: 100000 });
});

/** Adds a rate that hasn't started, and logs hours on its first day, which it prices. */
async function logHoursAtFutureRate(user: UserRow) {
  const day = addDays(todayInOslo(), 30);
  await addRateAndReprice(
    { projectId, userId: user.id },
    { validFrom: day, rate: 150000, currency: "NOK" },
  );
  const logged = await requestAsUser(
    user,
    (app) => app.route("/timesheet", timesheet),
    `/timesheet/month/${day.slice(0, 7)}/cells`,
    postForm({ taskId: String(taskId), date: day, hours: "7,5" }),
  );
  expect(logged.status).toBe(303);
  expect(await priceOfEntry(user)).toEqual({ rate: 150000, currency: "NOK" });
  return day;
}

const priceOfEntry = async (user: UserRow) =>
  onlyRow(
    await database
      .select({ rate: timeEntries.rate, currency: timeEntries.currency })
      .from(timeEntries)
      .where(eq(timeEntries.userId, user.id)),
  );

const deleteRatePath = (user: UserRow, validFrom: string) =>
  `/projects/${projectId}/consultants/${user.id}/rates/${validFrom}/delete`;

const requestAsManager = (path: string, init?: RequestInit) =>
  requestAsUser(
    manager,
    (app) => app.route("/projects/:projectId/consultants", projectConsultants),
    path,
    init,
  );

test("deleting a rate that hasn't started shows the hours it reprices before it goes", async () => {
  const day = await logHoursAtFutureRate(consultant);

  const page = await requestAsManager(deleteRatePath(consultant, day));
  expect(page.status).toBe(200);
  expect(await page.text()).toContain("Deleting it reprices 1 logged entry on Website at");
  expect(await priceOfEntry(consultant)).toEqual({ rate: 150000, currency: "NOK" });
});

test("deleting a rate that hasn't started reprices its logged hours at the rate before it", async () => {
  const day = await logHoursAtFutureRate(consultant);

  const deleted = await requestAsManager(deleteRatePath(consultant, day), postForm({}));
  expect(deleted.status).toBe(303);
  expect(await priceOfEntry(consultant)).toEqual({ rate: 100000, currency: "NOK" });
});

test("deleting the only rate leaves its logged hours without one", async () => {
  const day = await logHoursAtFutureRate(consultantWithoutRates);

  const deleted = await requestAsManager(deleteRatePath(consultantWithoutRates, day), postForm({}));
  expect(deleted.status).toBe(303);
  expect(await priceOfEntry(consultantWithoutRates)).toEqual({ rate: null, currency: null });
});
