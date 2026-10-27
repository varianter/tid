import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { z } from "zod";
import { pageUrl } from "../query/pageUrl";
import { isPeriod } from "./officeSummaryPeriod";

export const officeSummaryUrl = pageUrl(
  "/office-summary",
  z.object({ period: z.string().refine(isPeriod).catch(thisMonthInOslo) }),
);
