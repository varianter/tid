import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { z } from "zod";
import { pageUrl } from "../query/pageUrl";
import { isPeriod } from "./applesaucePeriod";

export const applesauceUrl = pageUrl(
  "/applesauce",
  z.object({ period: z.string().refine(isPeriod).catch(thisMonthInOslo) }),
);
