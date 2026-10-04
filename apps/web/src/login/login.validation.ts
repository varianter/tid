import { z } from "zod";

export const signupForm = z.object({
  firstName: z.string().trim().min(1, "Enter your first name"),
  lastName: z.string().trim().min(1, "Enter your last name"),
  organizationId: z.coerce.number().int(),
});
