import { z } from "zod";

export const clientForm = z.object({ name: z.string().trim().min(1, "Enter a name") });
