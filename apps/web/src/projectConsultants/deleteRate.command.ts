import { isIsoDate } from "@tid/calendar/isoDate";
import { todayInOslo } from "@tid/calendar/osloClock";
import { assignmentRates } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../framework/database";
import { idParams, ratesOf } from "./projectConsultant";
import { projectRatesPath } from "./projectConsultants.url";

// Only a rate that hasn't started can go. A started one has priced logged time, so it's
// corrected by adding a rate on the same day instead.
export const deleteRate = async (c: Context) => {
  const ids = idParams(c.req.param());
  const validFrom = c.req.param("validFrom") ?? "";
  if (!ids || !isIsoDate(validFrom)) return c.notFound();
  if (validFrom <= todayInOslo()) return c.text("A rate that has started can't be deleted", 403);
  await database
    .delete(assignmentRates)
    .where(and(ratesOf(ids), eq(assignmentRates.validFrom, validFrom)));
  return c.redirect(projectRatesPath(ids.projectId), 303);
};
