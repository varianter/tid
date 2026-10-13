import { z } from "zod";

export const signupForm = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  organizationId: z.coerce.number().int(),
});
