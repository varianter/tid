import { isIsoDate } from "@tid/calendar/isoDate";
import { z } from "zod";
import { formAction } from "../framework/formAction";
import { emptyAsMissing } from "../framework/formValues";
import { idParams } from "./projectConsultant";
import { loadConsultant } from "./projectConsultant.data";
import { projectRatesPath } from "./projectConsultants.url";
import { RepriceEntriesFormPage, repriceEntriesForm } from "./repriceEntries.form";
import { addRateAndReprice, entriesToReprice } from "./repricing.data";

// The rate in minor units, as the rates form passes it on.
const repriceQuery = z.object({
  rate: z.preprocess(emptyAsMissing, z.coerce.number().int().min(0)),
  validFrom: z.string().refine(isIsoDate),
});

export const repriceEntries = formAction({
  schema: repriceEntriesForm,
  loader: async (c) => {
    const ids = idParams(c.req.param());
    const query = repriceQuery.safeParse(c.req.query());
    if (!ids || !query.success) return c.notFound();
    const consultant = await loadConsultant(ids);
    if (!consultant) return c.notFound();
    const newRate = { ...query.data, currency: consultant.currency };
    return { consultant, newRate, entries: await entriesToReprice(ids, newRate) };
  },
  onSubmit: async (_c, _form, { consultant, newRate }) => {
    await addRateAndReprice(consultant, newRate);
    return { redirect: projectRatesPath(consultant.projectId) };
  },
  view: RepriceEntriesFormPage,
});
