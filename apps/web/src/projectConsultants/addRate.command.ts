import { todayInOslo } from "@tid/calendar/osloClock";
import { formAction } from "../framework/formAction";
import { AddRateFormPage, addRateForm } from "./addRate.form";
import { idParams } from "./projectConsultant";
import { loadConsultant } from "./projectConsultant.data";
import { projectRatesPath, ratesPath } from "./projectConsultants.url";
import { addRateAndReprice, entriesToReprice } from "./repricing.data";

export const addRate = formAction({
  schema: addRateForm,
  loader: async (c) => {
    const ids = idParams(c.req.param());
    if (!ids) return c.notFound();
    const consultant = await loadConsultant(ids);
    if (!consultant) return c.notFound();
    return { consultant, today: todayInOslo() };
  },
  // A rate that changes logged time is confirmed on its own page first.
  onSubmit: async (_c, form, { consultant }) => {
    const newRate = { ...form, currency: consultant.currency };
    if ((await entriesToReprice(consultant, form.validFrom, newRate)).length > 0) {
      const query = new URLSearchParams({ validFrom: form.validFrom, rate: String(form.rate) });
      return { redirect: `${ratesPath(consultant)}/reprice?${query}` };
    }
    await addRateAndReprice(consultant, newRate);
    return { redirect: projectRatesPath(consultant.projectId) };
  },
  view: AddRateFormPage,
});
