import { renderPdf } from "@tid/pdf-export";
import { zipSync } from "fflate";
import type { Context } from "hono";
import { getBunServer } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import type { UserEnv } from "../domain/users/user";
import { fileDownload } from "../framework/fileDownload";
import { loadInvoicedProjectReport } from "../projects/projectReport.data";
import {
  invoiceDataFileName,
  invoiceDataTemplate,
  invoiceDataZipFileName,
  toInvoiceData,
} from "./invoiceData";
import { invoiceDataCsvUrl, invoiceDataPdfUrl, invoiceDataZipUrl } from "./invoiceData.url";
import { toInvoiceDataCsv } from "./invoiceDataCsv";
import { loadInvoiceDataCsv } from "./invoiceDataCsv.data";
import {
  loadProjectsToInvoice,
  loadProjectToInvoice,
  type ProjectToInvoice,
} from "./projectsToInvoice.data";

type InvoiceDataFile = { name: string; body: Uint8Array };

export const invoiceDataPdf = async (c: Context<UserEnv>) => {
  const query = invoiceDataPdfUrl.read(c.req.url);
  const file = query && (await pdfFile(query.projectId, query.month));
  if (!file) return c.notFound();
  return fileDownload(file.body, file.name, "application/pdf");
};

export const invoiceDataCsv = async (c: Context<UserEnv>) => {
  const query = invoiceDataCsvUrl.read(c.req.url);
  const file = query && (await csvFile(query.projectId, query.month));
  if (!file) return c.notFound();
  return fileDownload(file.body, file.name, "text/csv; charset=utf-8");
};

export const invoiceDataZip = async (c: Context<UserEnv>) => {
  const query = invoiceDataZipUrl.read(c.req.url);
  if (!query) return c.notFound();
  // Nothing is sent until every project's files are made, which can outlast Bun's idle timeout.
  // Tests call the app without a Bun server.
  if (c.env) getBunServer<Bun.Server<unknown>>(c)?.timeout(c.req.raw, 0);
  const projects = await loadProjectsToInvoice(query.month, query.fixedPrice === true);
  const files: Record<string, Uint8Array> = {};
  for (const project of projects) {
    for (const file of await bothFiles(project, query.month)) files[file.name] = file.body;
  }
  // PDFs are compressed already, so the zip only stores them.
  const zip = zipSync(files, { level: 0 });
  return fileDownload(zip, invoiceDataZipFileName(query.month), "application/zip");
};

/** Undefined for a project that isn't in `month`'s invoice data. */
async function pdfFile(projectId: number, month: string): Promise<InvoiceDataFile | undefined> {
  if (!(await loadProjectToInvoice(projectId, month))) return undefined;
  const report = await loadInvoicedProjectReport(projectId, month);
  if (!report) return undefined;
  return {
    name: invoiceDataFileName(report.project.code, "pdf"),
    body: await renderPdf(invoiceDataTemplate, toInvoiceData(report)),
  };
}

/** Undefined for a project that isn't in `month`'s invoice data. */
async function csvFile(projectId: number, month: string): Promise<InvoiceDataFile | undefined> {
  if (!(await loadProjectToInvoice(projectId, month))) return undefined;
  const csv = await loadInvoiceDataCsv(projectId, month);
  if (!csv) return undefined;
  return {
    name: invoiceDataFileName(csv.projectCode, "csv"),
    body: new TextEncoder().encode(toInvoiceDataCsv(csv.entries)),
  };
}

/**
 * One at a time, and failing the whole zip if a project's files can't be made: a zip missing an
 * invoice's data is easy to send without noticing.
 */
async function bothFiles(project: ProjectToInvoice, month: string) {
  const which = `${project.name} (${project.code})`;
  let pdf: InvoiceDataFile | undefined;
  let csv: InvoiceDataFile | undefined;
  try {
    pdf = await pdfFile(project.id, month);
    csv = await csvFile(project.id, month);
  } catch (error) {
    throw new HTTPException(500, {
      message: `The invoice data of ${which} couldn't be made, so nothing was downloaded`,
      cause: error,
    });
  }
  // The list only holds projects in the month's invoice data, so this one changed while the zip was made.
  if (!pdf || !csv) {
    throw new HTTPException(409, {
      message: `${which} changed while the zip was made, so it's no longer invoiced. Try again.`,
    });
  }
  return [pdf, csv];
}
