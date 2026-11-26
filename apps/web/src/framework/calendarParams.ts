import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

/** A day in a form or URL, as `YYYY-MM-DD`. Temporal reads other spellings too; this keeps one. */
export const dayParam = (message?: string) =>
  z.codec(z.iso.date(message), z.instanceof(Temporal.PlainDate), {
    decode: (text) => Temporal.PlainDate.from(text),
    encode: (day) => day.toString(),
  });

/** A month in a page's path, as `YYYY-MM`, so each month has one URL. */
export const monthParam = z.codec(
  z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  z.instanceof(Temporal.PlainYearMonth),
  { decode: (text) => Temporal.PlainYearMonth.from(text), encode: (month) => month.toString() },
);

/** `?month=YYYY-MM`, falling back to this month. Spread into a page's query. */
export const monthField = { month: monthParam.catch(thisMonthInOslo) };

export type MonthParamEnv = { Variables: { month: Temporal.PlainYearMonth } };

/** Reads the `:month` route param into `month`, or answers not found when it isn't one. */
export const monthFromParam = createMiddleware<MonthParamEnv>(async (c, next) => {
  const month = monthParam.safeParse(c.req.param("month"));
  if (!month.success) return c.notFound();
  c.set("month", month.data);
  await next();
});
