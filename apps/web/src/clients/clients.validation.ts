import { z } from "zod";

export const newClientForm = z.object({ name: z.string().trim().min(1, "Enter a name") });
