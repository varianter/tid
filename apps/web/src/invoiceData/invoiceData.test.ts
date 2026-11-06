import { beforeAll, expect, test } from "bun:test";
import { unzipSync } from "fflate";
import type { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { seedInvoicingMonth } from "../testing/invoicingMonth";
import { requestAsUser, type UserRow } from "../testing/loggedInUser";
import { invoiceData } from "./invoiceData.routes";

let member: UserRow;
let portalId: number;
let internalId: number;

const mount = (app: Hono<UserEnv>) => app.route("/invoice-data", invoiceData);
const requestAs = (user: UserRow, path: string) => requestAsUser(user, mount, path);

const isPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";

beforeAll(async () => {
  ({ member, portalId, internalId } = await seedInvoicingMonth());
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

test("a project outside the month's invoice data has no files to download", async () => {
  for (const file of ["pdf", "csv"]) {
    const response = await requestAs(member, `/invoice-data/${internalId}/${file}?month=2026-10`);
    expect(response.status).toBe(404);
  }
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
