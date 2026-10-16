import { billing } from "@tid/db/schema";

export type Billing = (typeof billing.enumValues)[number];

export const billings = billing.enumValues;

export const billingLabels: Record<Billing, string> = {
  hourly: "Hourly",
  fixed_fee: "Fixed price",
  non_billable: "Non-billable",
};
