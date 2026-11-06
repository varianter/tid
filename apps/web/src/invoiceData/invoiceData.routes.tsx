import { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { invoiceDataCsv, invoiceDataPdf, invoiceDataZip } from "./invoiceData.query";

export const invoiceData = new Hono<UserEnv>()
  .get("/zip", invoiceDataZip)
  .get("/:projectId/pdf", invoiceDataPdf)
  .get("/:projectId/csv", invoiceDataCsv);
