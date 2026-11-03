import { beforeAll, expect, test } from "bun:test";
import { rebuildDatabase } from "@tid/db/client";
import { clients, projectOrganizations, projects, tasks, timeEntries, users } from "@tid/db/schema";
import { unzipSync } from "fflate";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { requestAsUser, type UserRow } from "../testing/loggedInUser";
import { onlyRow, organizationIdBySlug } from "../testing/rows";
import { invoiceData } from "./invoiceData.routes";

let member: UserRow;
let portalId: number;

const mount = (app: Hono<UserEnv>) => app.route("/invoice-data", invoiceData);
const requestAs = (user: UserRow, path: string) => requestAsUser(user, mount, path);

const isPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";

beforeAll(async () => {
  await rebuildDatabase(database);
  const oslo = await organizationIdBySlug("oslo");
  const bergen = await organizationIdBySlug("bergen");
  const stockholm = await organizationIdBySlug("stockholm");
  [member] = (await database
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
  portalId = portal.id;
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
});

// Every organization invoices, so everyone sees every country's projects.
test("the invoice data page lists every country's hourly projects, and fixed price when asked", async () => {
  const page = async (query: string) =>
    (await requestAs(member, `/invoice-data?month=2026-10${query}`)).text();

  const hourly = await page("");
  expect(hourly).toContain("Portal");
  expect(hourly).toContain("Bergen owned");
  expect(hourly).toContain("Swedish");
  expect(hourly).not.toContain("Fixed");
  expect(hourly).not.toContain("Internal");
  expect(await page("&fixedPrice=yes")).toContain("Fixed");
});

test("one project's invoice data downloads as a PDF named after its code", async () => {
  const response = await requestAs(member, `/invoice-data/${portalId}/pdf?month=2026-10`);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Content-Disposition")).toContain('filename="OL-1.pdf"');
  expect(isPdf(await response.bytes())).toBe(true);
});

// Byte for byte, since it replaces the legacy system's export, whatever reads it.
test("one project's entries download as a CSV shaped like the legacy export", async () => {
  const response = await requestAs(member, `/invoice-data/${portalId}/csv?month=2026-10`);
  expect(response.headers.get("Content-Disposition")).toContain('filename="OL-1.csv"');
  // Kept, since `text()` would drop the BOM.
  const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await response.bytes());
  expect(csv).toBe(
    [
      "\uFEFFProjectCode;ProjectName;SpentDate;User;Task;Hours;Amount",
      "OL-1;Portal;06.10.2026;Per;Build;1;0",
      "OL-1;Portal;05.10.2026;Ola;Build;7,5;11250",
    ].join("\n"),
  );
});

test("the zip holds the invoice data of every project on the page", async () => {
  const response = await requestAs(member, "/invoice-data/zip?month=2026-10&fixedPrice=yes");
  expect(response.headers.get("Content-Type")).toBe("application/zip");
  expect(response.headers.get("Content-Disposition")).toContain(
    'filename="10 October - invoice data.zip"',
  );
  const files = unzipSync(await response.bytes());
  expect(Object.keys(files)).toEqual([
    "OL-4.pdf",
    "OL-4.csv",
    "OL-2.pdf",
    "OL-2.csv",
    "OL-1.pdf",
    "OL-1.csv",
    "OL-5.pdf",
    "OL-5.csv",
  ]);
  const pdfs = Object.entries(files).filter(([name]) => name.endsWith(".pdf"));
  expect(pdfs.every(([, bytes]) => isPdf(bytes))).toBe(true);
});
