import { z } from "zod";

export const newProjectForm = z.object({
  clientId: z.coerce.number().int(),
  name: z.string().trim().min(1, "Enter a name"),
  // The reporting database holds at most 16 characters.
  code: z.string().trim().min(1, "Enter a code").max(16, "At most 16 characters"),
  billable: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
});
