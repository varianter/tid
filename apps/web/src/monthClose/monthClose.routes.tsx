import { Hono } from "hono";
import type { UserEnv } from "../domain/users/user";
import { consultantHoursList, consultantHoursListRedirect } from "./consultantHoursList.query";
import { invoiceDataList } from "./invoiceDataList.query";
import { lockChangeManagersOnly } from "./lockChange.middleware";
import { lockMonth } from "./lockMonth.command";
import { monthCloseOverview, monthCloseOverviewRedirect } from "./monthCloseOverview.query";
import { unlockMonth } from "./unlockMonth.command";

export const monthClose = new Hono<UserEnv>()
  .get("/", monthCloseOverviewRedirect)
  .get("/consultants", consultantHoursListRedirect)
  .get("/:month", monthCloseOverview)
  .get("/:month/consultants", consultantHoursList)
  .get("/:month/invoice-data", invoiceDataList)
  .post("/:organization/:month/lock", lockChangeManagersOnly, lockMonth)
  .post("/:organization/:month/unlock", lockChangeManagersOnly, unlockMonth);
