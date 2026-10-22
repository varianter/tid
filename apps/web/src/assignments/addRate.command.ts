import { todayInOslo } from "@tid/calendar/osloClock";
import { assignmentRates } from "@tid/db/schema";
import { desc } from "drizzle-orm";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { addRateForm, RatesPage } from "./addRate.form";
import { idParams, loadConsultant, ratesOf, ratesPath } from "./assignment";
import { addRateAndReprice, entriesToReprice } from "./repricing";

export const addRate = formAction({
  schema: addRateForm,
  loader: async (c) => {
    const ids = idParams(c.req.param());
    if (!ids) return c.notFound();
    const consultant = await loadConsultant(ids);
    if (!consultant) return c.notFound();
    const rates = await database
      .select({ validFrom: assignmentRates.validFrom, rate: assignmentRates.rate })
      .from(assignmentRates)
      .where(ratesOf(ids))
      .orderBy(desc(assignmentRates.validFrom));
    return { consultant, rates, today: todayInOslo() };
  },
  // A rate that changes logged time is confirmed on its own page first.
  onSubmit: async (_c, form, { consultant }) => {
    const newRate = { ...form, currency: consultant.currency };
    if ((await entriesToReprice(consultant, newRate)).length > 0) {
      const query = new URLSearchParams({ validFrom: form.validFrom, rate: String(form.rate) });
      return { redirect: `${ratesPath(consultant)}/reprice?${query}` };
    }
    await addRateAndReprice(consultant, newRate);
    return { redirect: ratesPath(consultant) };
  },
  view: RatesPage,
});
