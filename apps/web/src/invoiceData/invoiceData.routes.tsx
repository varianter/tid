import { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { invoiceDataCsv, invoiceDataPdf, invoiceDataZip } from "./invoiceData.query";
import { projectsToInvoice } from "./projectsToInvoice.query";

export const invoiceData = new Hono<UserEnv>()
  .get("/", projectsToInvoice)
  .get("/zip", invoiceDataZip)
  .get("/:projectId/pdf", invoiceDataPdf)
  .get("/:projectId/csv", invoiceDataCsv);
