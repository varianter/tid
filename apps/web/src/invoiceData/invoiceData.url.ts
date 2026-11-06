import { z } from "zod";
import { monthField } from "../framework/pageMonth";
import { idParam, pageUrl } from "../framework/pageUrl";
import { fixedPriceField } from "../projects/fixedPriceFilter";

/** Every project on month close's invoice data page, each as its PDF and CSV, in one zip. */
export const invoiceDataZipUrl = pageUrl(
  "/invoice-data/zip",
  z.object({ ...monthField, ...fixedPriceField }),
);

const projectInvoiceDataQuery = z.object({ projectId: idParam, ...monthField });

/** One project's hours in a month, as the PDF that goes with its invoice. */
export const invoiceDataPdfUrl = pageUrl("/invoice-data/:projectId/pdf", projectInvoiceDataQuery);

/** The same project's entries in a month, one row each, as the legacy system exported them. */
export const invoiceDataCsvUrl = pageUrl("/invoice-data/:projectId/csv", projectInvoiceDataQuery);
