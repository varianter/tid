import { z } from "zod";
import { isIsoDate } from "../dates/dates";

export const timesheetCell = z.object({
  taskId: z.coerce.number().int().positive(),
  date: z.string().refine(isIsoDate),
});

/** Hours as typed, in half hours up to a day, as minutes. Blank or zero clears the cell. */
export const cellHours = z
  .string()
  .trim()
  .regex(/^(\d+([.,]\d+)?)?$/, "Enter hours, like 7,5")
  .transform((text) => Number(text.replace(",", ".")))
  .refine((hours) => hours <= 24, "At most 24 hours")
  .refine((hours) => Number.isInteger(hours * 2), "Use half hours, like 1,5")
  .transform((hours) => hours * 60);
