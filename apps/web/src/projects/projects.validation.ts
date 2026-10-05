import { z } from "zod";

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

const projectFields = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  // The reporting database holds at most 16 characters.
  code: z.string().trim().min(1, "Enter a code").max(16, "At most 16 characters"),
  billable: checkbox,
  countsTowardBillableBase: checkbox,
});

const billableCountsTowardBase = <S extends typeof projectFields>(schema: S) =>
  schema.refine((form) => !form.billable || form.countsTowardBillableBase, {
    message: "Billable projects count toward the billable base",
  });

export const newProjectForm = billableCountsTowardBase(
  projectFields.extend({ clientId: z.coerce.number().int() }),
);

// The client is fixed once the project exists.
export const editProjectForm = billableCountsTowardBase(projectFields);
