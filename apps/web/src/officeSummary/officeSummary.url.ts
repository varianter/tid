import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { z } from "zod";
import { monthParam } from "../framework/calendarParams";
import { pageUrl } from "../framework/pageUrl";

/** A whole year in the URL, as `YYYY`. */
const yearParam = z.codec(z.string().regex(/^\d{4}$/), z.int(), {
  decode: Number,
  encode: String,
});

/** A period in the URL: a month as `YYYY-MM`, or a year as `YYYY`. */
export const officeSummaryUrl = pageUrl(
  "/office-summary",
  z.object({ period: z.union([monthParam, yearParam]).catch(thisMonthInOslo) }),
);
