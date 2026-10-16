import { isIsoDate } from "@tid/dates/isoDate";
import { todayInOslo } from "@tid/dates/osloClock";
import { assignmentRates } from "@tid/db/schema";
import { Button } from "@tid/ui";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { type AssignmentIds, idParams, ratesOf, ratesPath } from "./assignment";

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
  return c.redirect(ratesPath(ids), 303);
};

export function DeleteRateForm({ ids, validFrom }: { ids: AssignmentIds; validFrom: string }) {
  return (
    <form method="post" action={`${ratesPath(ids)}/${validFrom}/delete`}>
      <Button type="submit" data-variant="plain" data-size="small">
        Delete
      </Button>
    </form>
  );
}
