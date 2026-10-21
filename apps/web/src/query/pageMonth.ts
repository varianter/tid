import { isIsoMonth } from "@tid/calendar/isoDate";
import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { z } from "zod";

/** A month in a page's path, as `YYYY-MM`. */
export const monthParam = z.string().refine(isIsoMonth);

/** `?month=YYYY-MM`, falling back to this month. Spread into a page's query. */
export const monthField = { month: monthParam.catch(thisMonthInOslo) };
