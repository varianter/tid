import { isIsoDate } from "@tid/calendar/isoDate";
import { z } from "zod";
import { formAction } from "../form/formAction";
import { idParams, projectRatesPath } from "./projectConsultant";
import { loadConsultant } from "./projectConsultant.data";
import { RepriceFields, repriceEntriesForm, repriceFrame } from "./repriceEntries.form";
import { addRateAndReprice, entriesToReprice } from "./repricing";

// The rate in minor units, as the rates form passes it on.
const repriceQuery = z.object({
  rate: z.coerce.number().int().min(0),
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
  frame: repriceFrame,
  view: RepriceFields,
});
