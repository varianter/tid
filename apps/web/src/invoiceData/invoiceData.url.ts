import { z } from "zod";
import { monthField } from "../framework/pageMonth";
import { idParam, pageUrl } from "../framework/pageUrl";

/** `?fixedPrice=yes` adds fixed-price projects to hourly ones. */
const fixedPriceField = {
  fixedPrice: z
    .stringbool({ truthy: ["yes"], falsy: ["no"] })
    .optional()
    .catch(undefined),
};

const invoiceDataQuery = z.object({ ...monthField, ...fixedPriceField });

/** The projects to invoice for a month, whichever organization owns the contract. */
export const projectsToInvoiceUrl = pageUrl("/invoice-data", invoiceDataQuery);

/** Every project on the invoice data page, each as its PDF and CSV, in one zip. */
export const invoiceDataZipUrl = pageUrl("/invoice-data/zip", invoiceDataQuery);

const projectInvoiceDataQuery = z.object({ projectId: idParam, ...monthField });

/** One project's hours in a month, as the PDF that goes with its invoice. */
export const invoiceDataPdfUrl = pageUrl("/invoice-data/:projectId/pdf", projectInvoiceDataQuery);

/** The same project's entries in a month, one row each, as the legacy system exported them. */
export const invoiceDataCsvUrl = pageUrl("/invoice-data/:projectId/csv", projectInvoiceDataQuery);
