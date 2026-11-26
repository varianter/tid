import { todayInOslo } from "@tid/calendar/osloClock";
import { assignmentRates } from "@tid/db/schema";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { dayParam } from "../framework/calendarParams";
import { database } from "../framework/database";
import { formAction } from "../framework/formAction";
import { DeleteRateFormPage, deleteRateForm } from "./deleteRate.form";
import { idParams, ratesOf } from "./projectConsultant";
import { loadConsultant } from "./projectConsultant.data";
import { projectRatesPath } from "./projectConsultants.url";
import { rateDeletedFlash } from "./rateChanged";
import { deleteRateAndReprice, entriesToReprice, priceBefore } from "./repricing.data";

// Only a rate that hasn't started can go. A started one has priced logged time, so it's
// corrected by adding a rate on the same day instead. Hours can be logged ahead, so the rate
// before it reprices those.
export const deleteRate = formAction({
  schema: deleteRateForm,
  loader: async (c) => {
    const ids = idParams(c.req.param());
    const validFrom = dayParam().safeParse(c.req.param("validFrom")).data;
    if (!ids || !validFrom) return c.notFound();
    const consultant = await loadConsultant(ids);
    const [rate] = await database
      .select()
      .from(assignmentRates)
      .where(and(ratesOf(ids), eq(assignmentRates.validFrom, validFrom)));
    if (!consultant || !rate) return c.notFound();
    if (Temporal.PlainDate.compare(validFrom, todayInOslo()) <= 0)
      throw new HTTPException(403, { message: "A rate that has started can't be deleted" });
    const price = await priceBefore(ids, validFrom, consultant.currency);
    return { consultant, validFrom, price, entries: await entriesToReprice(ids, validFrom, price) };
  },
  onSubmit: async (_c, _form, { consultant, validFrom, price }) => {
    await deleteRateAndReprice(consultant, validFrom, price);
    return {
      redirect: projectRatesPath(consultant.projectId),
      flash: rateDeletedFlash(consultant.name, validFrom),
    };
  },
  view: DeleteRateFormPage,
});
